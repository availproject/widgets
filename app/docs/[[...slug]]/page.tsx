import Link from "next/link";
import { notFound } from "next/navigation";
import { findNeighbour } from "fumadocs-core/page-tree";
import { source } from "@/lib/source";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { Button } from "@/registry/avail-widgets/ui/button";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { OnThisPage } from "@/components/helpers/on-this-page";
import fm from "front-matter";
import { z } from "zod";
import { Badge } from "@/registry/avail-widgets/ui/badge";
import { DocsCopyPage } from "@/components/mdx/docs-copy-page";
import { absoluteUrl } from "@/lib/utils";
import { ComponentPreview } from "@/components/mdx/component-preview";

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }
  const doc = page.data;
  const title = doc.title || "";
  const description = doc.description || "";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5001";
  const url = new URL(page.url, baseUrl).toString();
  const ogParams = `title=${encodeURIComponent(
    title
  )}&description=${encodeURIComponent(description)}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [{ url: `/og?${ogParams}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: `/og?${ogParams}` }],
    },
  };
}

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }
  const doc = page.data;
  const MDX = doc.body;
  const neighbours = findNeighbour(source.pageTree, page.url);
  const raw = await page.data.getText("raw");
  const { attributes } = fm(raw);
  const { links, deprecated, deprecationMessage, preview } = z
    .object({
      links: z
        .object({
          doc: z.string().optional(),
          api: z.string().optional(),
        })
        .optional(),
      deprecated: z.boolean().optional(),
      deprecationMessage: z.string().optional(),
      preview: z
        .object({
          name: z.string(),
          align: z.enum(["center", "start", "end"]).optional(),
          hideCode: z.boolean().optional(),
          chromeLessOnMobile: z.boolean().optional(),
          showAllFiles: z.boolean().optional(),
          styleName: z.literal("avail-widgets").optional(),
        })
        .optional(),
    })
    .parse(attributes);

  return (
    <div className="flex items-stretch text-[1.05rem] sm:text-[15px] xl:w-full no-scrollbar">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-1 flex-col gap-8 px-4 py-4 text-neutral-800 md:px-0 dark:text-neutral-300">
          {preview ? (
            <ComponentPreview
              name={preview.name}
              align={preview.align}
              hideCode={preview.hideCode}
              chromeLessOnMobile={preview.chromeLessOnMobile}
              showAllFiles={preview.showAllFiles}
              styleName={preview.styleName}
              className="mt-0 mb-0"
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl">
                    {doc.title}
                  </h1>
                  {deprecated ? (
                    <Badge className="rounded-full border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                      Deprecated
                    </Badge>
                  ) : null}
                </div>
                <div className="docs-nav bg-background/80 border-border/50 fixed inset-x-0 bottom-0 isolate z-50 flex items-center gap-2 border-t px-6 py-4 backdrop-blur-sm sm:static sm:z-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pt-1.5 sm:backdrop-blur-none">
                  <DocsCopyPage page={raw} url={absoluteUrl(page.url)} />
                  {neighbours.previous && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="extend-touch-target ml-auto size-8 shadow-none md:size-7"
                      asChild
                    >
                      <Link href={neighbours.previous.url}>
                        <ArrowLeft />
                        <span className="sr-only">Previous</span>
                      </Link>
                    </Button>
                  )}
                  {neighbours.next && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="extend-touch-target size-8 shadow-none md:size-7"
                      asChild
                    >
                      <Link href={neighbours.next.url}>
                        <span className="sr-only">Next</span>
                        <ArrowRight />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              {doc.description && (
                <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
                  {doc.description}
                </p>
              )}
              {deprecated && deprecationMessage ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {deprecationMessage}
                </div>
              ) : null}
            </div>
            {links ? (
              <div className="flex items-center gap-2 pt-4">
                {links?.doc && (
                  <Badge asChild variant="secondary" className="rounded-full">
                    <a href={links.doc} target="_blank" rel="noreferrer">
                      Docs <ArrowUpRight />
                    </a>
                  </Badge>
                )}
                {links?.api && (
                  <Badge asChild variant="secondary" className="rounded-full">
                    <a href={links.api} target="_blank" rel="noreferrer">
                      API Reference <ArrowUpRight />
                    </a>
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
          <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">
            <MDX components={mdxComponents} />
          </div>
        </div>
        <div className="mx-auto hidden h-16 w-full max-w-2xl items-center gap-2 px-4 sm:flex md:px-0">
          {neighbours.previous && (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="shadow-none"
            >
              <Link href={neighbours.previous.url}>
                <ArrowLeft className="size-4" /> {neighbours.previous.name}
              </Link>
            </Button>
          )}
          {neighbours.next && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto shadow-none"
              asChild
            >
              <Link href={neighbours.next.url}>
                {neighbours.next.name} <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[calc(100svh-4.5rem)] w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0" />
        {doc.toc?.length ? (
          <div className="no-scrollbar overflow-y-auto px-8">
            <OnThisPage toc={doc.toc} />
            <div className="h-12" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
