import { Menu } from "@base-ui/react/menu";
import { cn } from "cn";

function DropdownMenu({ ...props }) {
  return <Menu.Root {...props} />;
}

function DropdownMenuTrigger({ ...props }) {
  return <Menu.Trigger {...props} />;
}

function DropdownMenuContent({ className, ...props }) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={6}>
        <Menu.Popup
          className={cn(
            "z-50 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, ...props }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
};
