import Link from 'next/link';
import { posts } from '@/data/blog';
import styles from './RecentPosts.module.css';

const RECENT_COUNT = 3;

export default function RecentPosts() {
  const recent = posts.slice(0, RECENT_COUNT);
  if (recent.length === 0) return null;

  return (
    <section className={styles.section} id="blog">
      <div className="container">
        <span className="section-label">Blog</span>
        <h2>Latest from the blog</h2>
        <p className="section-sub">
          Security guides, vulnerability research, and release notes.
        </p>

        <div className={styles.grid}>
          {recent.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.card}>
              <div className={styles.tags}>
                {post.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <h3 className={styles.title}>{post.title}</h3>
              <p className={styles.desc}>{post.description}</p>
              <span className={styles.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </Link>
          ))}
        </div>

        <div className={styles.footer}>
          <Link href="/blog" className={styles.allLink}>
            View all posts →
          </Link>
        </div>
      </div>
    </section>
  );
}
