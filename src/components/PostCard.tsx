import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Post } from "@/data/posts";
import { formatDate } from "@/data/posts";

interface PostCardProps {
  post: Post;
  index: number;
}

const PostCard = ({ post, index }: PostCardProps) => {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
    >
      <Link to={`/blog/${post.slug}`} className="group block py-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
          <time>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readTime}</span>
          <span>·</span>
          <span className="text-primary/80">{post.tags[0]}</span>
        </div>
        <h2 className="text-lg font-normal text-foreground mb-1.5 group-hover:text-primary transition-colors duration-200">
          {post.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {post.excerpt}
        </p>
      </Link>
    </motion.article>
  );
};

export default PostCard;
