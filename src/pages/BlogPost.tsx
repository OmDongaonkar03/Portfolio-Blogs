import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { getPostBySlug, formatDate } from "@/data/posts";
import Navbar from "@/components/Navbar";
import ReadingProgress from "@/components/ReadingProgress";
import NotFound from "./NotFound";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) return <NotFound />;

  const postUrl = `https://blogs.omdongaonkar.in/blog/${post.slug}`;

  return (
    <>
      <Helmet>
        <title>{post.title} | Om Dongaonkar</title>
        <meta name="description" content={post.excerpt} />
        <link rel="canonical" href={postUrl} />

        <meta property="og:type" content="article" />
        <meta property="og:url" content={postUrl} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta
          property="og:image"
          content="https://omdongaonkar.in/og-image.png"
        />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content="Om Dongaonkar" />
        <meta property="article:tag" content={post.tags.join(", ")} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta
          name="twitter:image"
          content="https://omdongaonkar.in/og-image.png"
        />
        <meta name="twitter:creator" content="@OmDongaonkar03" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            dateModified: post.date,
            url: postUrl,
            author: {
              "@type": "Person",
              name: "Om Dongaonkar",
              url: "https://omdongaonkar.in",
            },
            publisher: {
              "@type": "Person",
              name: "Om Dongaonkar",
              url: "https://omdongaonkar.in",
            },
            keywords: post.tags.join(", "),
            inLanguage: "en",
            isPartOf: {
              "@type": "Blog",
              name: "Blogs | Om Dongaonkar",
              url: "https://blogs.omdongaonkar.in",
            },
          })}
        </script>
      </Helmet>

      <ReadingProgress />
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>

          <header className="mb-10">
            <h1 className="text-3xl font-normal tracking-tight text-foreground mb-3">
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <time>{formatDate(post.date)}</time>
              <span>·</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          <article className="prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content}
            </ReactMarkdown>
          </article>
        </motion.div>
      </main>
    </>
  );
};

export default BlogPost;