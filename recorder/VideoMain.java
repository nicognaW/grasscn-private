import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.LogoRenderer;
import net.minecraft.client.gui.components.SplashRenderer;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.renderer.Panorama;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

/**
 * Launch-video recorder: renders the vanilla title screen frame by frame on a virtual
 * 60 fps clock and writes each finished frame as PNG.
 * -Dvideo.mode=title|panorama  -Dvideo.frames=N  -Dvideo.out=DIR  -Dvideo.splash=TEXT
 */
public final class VideoMain {
    static final String MODE = System.getProperty("video.mode", "title");
    static final int FRAMES = Integer.getInteger("video.frames", 240);
    /** First frame index to record; clock and spin depend only on the index, so passes can be extended. */
    static final int START = Integer.getInteger("video.start", 0);
    static final Path OUT = Path.of(System.getProperty("video.out"));
    static final String SPLASH = System.getProperty("video.splash", "Now with components!");
    static final long FRAME_NANOS = 1_000_000_000L / 60;
    /** Panorama spin per 60 fps frame: 0.1 degrees per tick, 20 ticks per second. */
    static final float SPIN_PER_FRAME = 0.1f * 20f / 60f;

    static final float START_SPIN = Float.parseFloat(System.getProperty("video.spin", "0"));
    static volatile boolean virtual;
    static volatile long virtualNanos;

    public static void main(String[] args) {
        Thread installer = new Thread(() -> {
            try {
                long deadline = System.nanoTime() + 300_000_000_000L;
                while (System.nanoTime() < deadline) {
                    Minecraft client = Minecraft.getInstance();
                    if (client != null && client.isGameLoadFinished() && client.gui.overlay() == null
                        && client.gui.screen() instanceof TitleScreen) {
                        Thread.sleep(2000);
                        client.execute(() -> {
                            // The client installs its own time source during startup, so ours goes in after load.
                            virtualNanos = System.nanoTime();
                            Util.setTimeSource(() -> virtual ? virtualNanos : System.nanoTime());
                            virtual = true;
                            client.gameRenderer.panorama().holdSpin();
                            client.options.hideSplashTexts().set(MODE.equals("nosplash"));
                            client.gui.setScreen(MODE.equals("panorama") ? new PanoramaOnly() : new RecordedTitle());
                        });
                        return;
                    }
                    Thread.sleep(200);
                }
                throw new IllegalStateException("Client did not reach the title screen");
            } catch (Throwable error) {
                error.printStackTrace();
                System.exit(2);
            }
        }, "video-installer");
        installer.setDaemon(true);
        installer.start();
        net.minecraft.client.main.Main.main(args);
    }

    /** Shared frame stepping: one state per frame, captured only after it has fully rendered. */
    static final class Stepper {
        /** Whole-second base, so virtual millis = frame * 1000 / 60 (mod 1000) for the splash pulse. */
        private final long baseNanos = (virtualNanos / 1_000_000_000L + 1) * 1_000_000_000L;
        private int frame = START;
        private int extractsSinceAdvance;
        private boolean awaiting;

        void beforeExtract(Minecraft client) throws Exception {
            virtualNanos = baseNanos + frame * FRAME_NANOS;
            client.gameRenderer.panorama().holdSpin();
            if (Util.getNanos() != virtualNanos) throw new IllegalStateException("Virtual clock not in effect");
            setSpin(client.gameRenderer.panorama(), START_SPIN + frame * SPIN_PER_FRAME);
            extractsSinceAdvance++;
            if (awaiting || extractsSinceAdvance < 3) return;
            awaiting = true;
            final int captured = frame;
            Screenshot.takeScreenshot(client.gameRenderer.mainRenderTarget(), image -> {
                try (image) {
                    Files.createDirectories(OUT);
                    image.writeToFile(OUT.resolve(String.format("%s-%05d.png", MODE, captured)));
                } catch (Exception error) {
                    error.printStackTrace();
                    System.exit(3);
                }
                client.execute(() -> {
                    frame++;
                    extractsSinceAdvance = 0;
                    awaiting = false;
                    if (frame >= FRAMES) {
                        System.out.println("VIDEO_RECORD_COMPLETE " + MODE + " " + FRAMES);
                        client.stop();
                    }
                });
            });
        }
    }

    static void setSpin(Panorama panorama, float degrees) throws Exception {
        Field spin = Panorama.class.getDeclaredField("spin");
        spin.setAccessible(true);
        spin.setFloat(panorama, degrees);
    }

    static final class RecordedTitle extends TitleScreen {
        private final Stepper stepper = new Stepper();

        RecordedTitle() {
            super(false, new LogoRenderer(false));
            try {
                Field splash = TitleScreen.class.getDeclaredField("splash");
                splash.setAccessible(true);
                java.lang.reflect.Method literal = net.minecraft.client.resources.SplashManager.class.getDeclaredMethod("literalSplash", String.class);
                literal.setAccessible(true);
                splash.set(this, new SplashRenderer((Component) literal.invoke(null, SPLASH)));
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        }

        @Override public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {
            try {
                stepper.beforeExtract(minecraft);
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
            super.extractRenderState(graphics, -1000, -1000, partialTick);
        }
    }

    static final class PanoramaOnly extends Screen {
        private final Stepper stepper = new Stepper();

        PanoramaOnly() {
            super(Component.literal("Panorama"));
        }

        @Override public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {
            try {
                stepper.beforeExtract(minecraft);
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
            // Same sequence as TitleScreen: empty background, panorama drawn in extractRenderState.
            extractPanorama(graphics, partialTick);
            super.extractRenderState(graphics, -1000, -1000, partialTick);
        }

        @Override public void extractBackground(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {}

        @Override public boolean shouldCloseOnEsc() { return false; }
    }
}
