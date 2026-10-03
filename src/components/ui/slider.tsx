import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  ...props
}: SliderPrimitive.SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-11 w-full touch-none items-center select-none",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow rounded-xs bg-raised">
        <SliderPrimitive.Range className="absolute h-full rounded-xs bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full bg-fg shadow-[0_0_0_1px_rgba(230,228,220,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
    </SliderPrimitive.Root>
  );
}
