import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const interviews = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/interviews" }),
  schema: z.object({
    name: z.string(),
    slug: z.string().optional(),
    portrait: z.string(),
    publishedAt: z.coerce.date(),
    bio: z.object({
      from: z.string().optional(),
      age: z.coerce.number().optional(),
      college: z.string().optional(),
      graduateSchool: z.string().optional(),
      career: z.string().optional(),
    }),
    qa: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    ),
    excerpt: z.string().optional(),
  }),
});

export const collections = { interviews };
