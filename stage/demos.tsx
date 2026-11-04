"use client";

// Scale-3 versions of the repository examples for the launch video boards. Local-only.
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "../../registry/ui/avatar";
import { Badge } from "../../registry/ui/badge";
import { Button } from "../../registry/ui/button";
import { Checkbox } from "../../registry/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../registry/ui/dropdown-menu";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "../../registry/ui/input-otp";
import { Kbd, KbdGroup } from "../../registry/ui/kbd";
import { Label } from "../../registry/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../registry/ui/pagination";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "../../registry/ui/popover";
import { Progress } from "../../registry/ui/progress";
import { RadioGroup, RadioGroupItem } from "../../registry/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../registry/ui/select";
import { Slider } from "../../registry/ui/slider";
import { Switch } from "../../registry/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../registry/ui/tabs";
import { Toggle } from "../../registry/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "../../registry/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../registry/ui/tooltip";
import { Typography } from "../../registry/ui/typography";

const row: React.CSSProperties = { alignItems: "center", display: "flex", gap: 18 };

const modes = [
  { label: "Survival", value: "survival" },
  { label: "Creative", value: "creative" },
  { label: "Adventure", value: "adventure" },
];

export const SelectDemo = () => {
  const [mode, setMode] = React.useState<string | null>("survival");
  return (
    <Select items={modes} value={mode} onValueChange={setMode} scale={3}>
      <SelectTrigger aria-label="Game mode" style={{ width: 420 }}>
        <SelectValue placeholder="Choose game mode" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} sideOffset={6}>
        {modes.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const TooltipDemo = () => (
  <TooltipProvider delay={0}>
    <Tooltip>
      <TooltipTrigger render={<Button scale={3} />}>Inspect pickaxe</TooltipTrigger>
      <TooltipContent scale={3}>{"Diamond Pickaxe\nA helpful description."}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const DropdownDemo = () => {
  const [coordinates, setCoordinates] = React.useState(false);
  return (
    <DropdownMenu scale={3}>
      <DropdownMenuTrigger>Game menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Resume game</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={coordinates} onCheckedChange={setCoordinates} closeOnClick={false}>
          Show coordinates
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ToggleDemo = () => {
  const [pressed, setPressed] = React.useState(false);
  return (
    <div style={row}>
      <Toggle scale={3} aria-label="Only craftable recipes" pressed={pressed} onPressedChange={setPressed} />
      <Label scale={3}>Craftable only</Label>
    </div>
  );
};

export const PopoverDemo = () => (
  <Popover scale={3}>
    <PopoverTrigger>World options</PopoverTrigger>
    <PopoverContent>
      <PopoverHeader>
        <PopoverTitle>World settings</PopoverTitle>
        <PopoverDescription>Configure your world.</PopoverDescription>
      </PopoverHeader>
    </PopoverContent>
  </Popover>
);

export const SliderDemo = () => {
  const [volume, setVolume] = React.useState<number[]>([30]);
  return (
    <div style={{ width: 480 }}>
      <Slider
        scale={3}
        aria-label="Volume"
        label={`Volume: ${volume[0]}%`}
        value={volume}
        onValueChange={(next) => setVolume(Array.isArray(next) ? next : [next])}
      />
    </div>
  );
};

export const SwitchDemo = () => {
  const id = React.useId();
  const [checked, setChecked] = React.useState(false);
  return (
    <div style={row}>
      <Switch scale={3} id={id} checked={checked} onCheckedChange={setChecked} />
      <Label scale={3} htmlFor={id}>Clouds</Label>
    </div>
  );
};

export const CheckboxDemo = () => {
  const id = React.useId();
  const [checked, setChecked] = React.useState(false);
  return (
    <div style={row}>
      <Checkbox scale={3} id={id} checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      <Label scale={3} htmlFor={id}>Enable shadows</Label>
    </div>
  );
};

export const RadioDemo = () => {
  const id = React.useId();
  const [mode, setMode] = React.useState("survival");
  return (
    <RadioGroup scale={3} aria-label="World mode" value={mode} onValueChange={setMode}>
      {["survival", "creative"].map((value) => (
        <div key={value} style={row}>
          <RadioGroupItem id={`${id}-${value}`} value={value} />
          <Label scale={3} htmlFor={`${id}-${value}`}>{value === "survival" ? "Survival" : "Creative"}</Label>
        </div>
      ))}
    </RadioGroup>
  );
};

export const ToggleGroupDemo = () => {
  const [stations, setStations] = React.useState<string[]>(["crafting"]);
  return (
    <ToggleGroup scale={3} aria-label="Crafting station" multiple={false} value={stations} onValueChange={setStations}>
      <ToggleGroupItem value="crafting" aria-label="Crafting table" />
      <ToggleGroupItem value="furnace" aria-label="Furnace" />
    </ToggleGroup>
  );
};

export const OtpDemo = () => {
  const [value, setValue] = React.useState("");
  return (
    <InputOTP scale={3} aria-label="One-time code" maxLength={4} value={value} onChange={setValue} inputMode="text" pushPasswordManagerStrategy="none">
      <InputOTPGroup>
        {[0, 1].map((index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {[2, 3].map((index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
};

export const TabsDemo = () => {
  const [value, setValue] = React.useState("game");
  return (
    <Tabs scale={3} value={value} onValueChange={setValue} style={{ width: 480 }}>
      <TabsList aria-label="World settings">
        <TabsTrigger value="game">Game</TabsTrigger>
        <TabsTrigger value="world">World</TabsTrigger>
        <TabsTrigger value="more">More</TabsTrigger>
      </TabsList>
      <TabsContent value="game" style={{ height: 96, padding: 18 }}>
        <Typography>Difficulty: Normal</Typography>
      </TabsContent>
      <TabsContent value="world" style={{ height: 96, padding: 18 }}>
        <Typography>Generate structures</Typography>
      </TabsContent>
      <TabsContent value="more" style={{ height: 96, padding: 18 }}>
        <Typography>Allow commands</Typography>
      </TabsContent>
    </Tabs>
  );
};

export const PaginationDemo = () => {
  const [page, setPage] = React.useState(1);
  const go = (event: React.MouseEvent, next: number) => {
    event.preventDefault();
    setPage(next);
  };
  return (
    <Pagination aria-label="Recipe pages">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious scale={3} href="#" aria-disabled={page === 1} onClick={(e) => go(e, Math.max(1, page - 1))} />
        </PaginationItem>
        {[1, 2, 3].map((number) => (
          <PaginationItem key={number}>
            <PaginationLink scale={3} href="#" isActive={page === number} onClick={(e) => go(e, number)}>
              {number}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext scale={3} href="#" aria-disabled={page === 3} onClick={(e) => go(e, Math.min(3, page + 1))} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export const ProgressDemo = () => {
  const [value, setValue] = React.useState(40);
  return (
    <div style={{ display: "grid", gap: 24, justifyItems: "center", width: 480 }}>
      <Progress scale={3} aria-label="World loading" value={value} />
      <Button scale={3} onClick={() => setValue(value === 100 ? 40 : 100)}>
        {value === 100 ? "Restart" : "Complete"}
      </Button>
    </div>
  );
};

export const BadgeDemo = () => (
  <Badge scale={3} achievement="challenge" earned>
    Diamonds!
  </Badge>
);

export const KbdDemo = () => (
  <KbdGroup aria-label="Control plus B">
    <Kbd scale={3}>Ctrl</Kbd>
    <Kbd scale={3}>B</Kbd>
  </KbdGroup>
);

export const AvatarDemo = () => (
  <AvatarGroup scale={3} aria-label="World members">
    <Avatar>
      <AvatarImage skin="wide/steve" alt="Steve" />
      <AvatarFallback>S</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarImage skin="slim/alex" alt="Alex" />
    </Avatar>
    <AvatarGroupCount aria-label="Two more players">+2</AvatarGroupCount>
  </AvatarGroup>
);
