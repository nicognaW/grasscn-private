"""Run the bundle's launch.py, swapping the vanilla main class for VideoMain."""
import os, sys, runpy
R = os.path.dirname(os.path.abspath(__file__))
G = os.environ['MC_BUNDLE']
real_execv = os.execv
def execv(path, argv):
    out = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ('-cp', '-classpath'):
            out += [a, os.path.join(R, 'classes') + ':' + argv[i + 1]]; i += 2; continue
        if a == 'net.minecraft.client.main.Main':
            out += [p for p in os.environ.get('VIDEO_OPTS', '').split() if p] + ['VideoMain']
        else:
            out.append(a)
        i += 1
    real_execv(path, out)
os.execv = execv
sys.argv = [os.path.join(G, 'launch.py')] + sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
