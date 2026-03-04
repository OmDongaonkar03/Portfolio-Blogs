import matter from "gray-matter";
import { Buffer } from "buffer";
window.Buffer = Buffer;

export interface Post {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  readTime: string;
  content: string;
}

// Vite loads all .md files from src/posts/ at build time
const modules = import.meta.glob("../posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function slugFromPath(path: string): string {
  // "../posts/my-post.md" → "my-post"
  return path.replace("../posts/", "").replace(".md", "");
}

export const posts: Post[] = Object.entries(modules)
  .map(([path, raw]) => {
    const { data, content } = matter(raw);
    return {
      slug: slugFromPath(path),
      title: data.title ?? "Untitled",
      date: data.date ?? "",
      tags: data.tags ?? [],
      excerpt: data.excerpt ?? "",
      readTime: data.readTime ?? "",
      content,
    };
  })
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
