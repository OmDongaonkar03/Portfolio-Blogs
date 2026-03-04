import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isPost = location.pathname.startsWith("/blog/");

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
        {/* Brand */}
        <Link
          to="/"
          className="text-sm tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Blogs
        </Link>

        {/* Right side */}
        <div className="flex items-center">
          <a
            href="https://omdongaonkar.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Portfolio
          </a>

          {/* Divider */}
          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;