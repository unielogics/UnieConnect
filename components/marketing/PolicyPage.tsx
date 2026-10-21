import Head from 'next/head';
import Link from 'next/link';
import { SiteShell } from './SiteShell';

type Props = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export const PolicyPage = ({ title, description, children }: Props) => (
  <>
    <Head>
      <title>{title} | UnieConnect</title>
      <meta name="description" content={description} />
    </Head>
    <SiteShell variant="audit">
      <main className="policy-page">
        <div className="wrap policy-wrap">
          <div className="policy-breadcrumb"><Link href="/">UnieConnect</Link><span>/</span>{title}</div>
          <header className="policy-header">
            <h1>{title}</h1>
            <p>{description}</p>
            <span>Last updated October 21, 2026</span>
          </header>
          <article className="policy-content">{children}</article>
        </div>
      </main>
    </SiteShell>
  </>
);
