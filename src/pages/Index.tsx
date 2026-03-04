import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { posts } from "@/data/posts";
import PostCard from "@/components/PostCard";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Blogs | Om Dongaonkar</title>
        <meta
          name="description"
          content="Thoughts on backend architecture, performance engineering, security, and building production-grade software."
        />
        <link rel="canonical" href="https://blogs.omdongaonkar.in/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://blogs.omdongaonkar.in/" />
        <meta property="og:title" content="Blogs | Om Dongaonkar" />
        <meta
          property="og:description"
          content="Thoughts on backend architecture, performance engineering, security, and building production-grade software."
        />
        <meta
          property="og:image"
          content="https://omdongaonkar.in/og-image.png"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Blogs | Om Dongaonkar" />
        <meta
          name="twitter:description"
          content="Thoughts on backend architecture, performance engineering, security, and building production-grade software."
        />
        <meta
          name="twitter:image"
          content="https://omdongaonkar.in/og-image.png"
        />
        <meta name="twitter:creator" content="@OmDongaonkar03" />
      </Helmet>

      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-28 pb-20">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-12"
        >
          <h1 className="text-2xl font-normal tracking-tight text-foreground mb-1">
            Om Amit Dongaonkar
          </h1>
          <p className="text-muted-foreground">Thoughts on building software</p>
        </motion.header>

        <div className="divide-y divide-border">
          {posts.map((post, i) => (
            <PostCard key={post.slug} post={post} index={i} />
          ))}
        </div>
      </main>
    </>
  );
};

export default Index;