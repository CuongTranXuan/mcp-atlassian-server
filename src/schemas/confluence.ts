/**
 * Schema definitions for Confluence resources
 */
import { standardMetadataSchema } from './common.js';
import { z } from 'zod';

/**
 * Schema for Confluence space
 */
export const spaceSchema = {
  type: "object",
  properties: {
    key: { type: "string", description: "Space key" },
    name: { type: "string", description: "Space name" },
    type: { type: "string", description: "Space type (global, personal, etc.)" },
    status: { type: "string", description: "Space status" },
    url: { type: "string", description: "Space URL" }
  },
  required: ["key", "name", "type"]
};

/**
 * Schema for Confluence spaces list
 */
export const spacesListSchema = {
  type: "object",
  properties: {
    metadata: standardMetadataSchema,
    spaces: {
      type: "array",
      items: spaceSchema
    }
  },
  required: ["metadata", "spaces"]
};

/**
 * Schema for Confluence page
 */
export const pageSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Page ID" },
    title: { type: "string", description: "Page title" },
    status: { type: "string", description: "Page status" },
    spaceId: { type: "string", description: "Space ID" },
    parentId: { type: "string", description: "Parent page ID", nullable: true },
    authorId: { type: "string", description: "Author ID", nullable: true },
    createdAt: { type: "string", description: "Creation date" },
    version: {
      type: "object",
      properties: {
        number: { type: "number", description: "Version number" },
        createdAt: { type: "string", description: "Version creation date" }
      }
    },
    body: { type: "string", description: "Page content (Confluence storage format)" },
    bodyType: { type: "string", description: "Content representation type" },
    _links: { type: "object", description: "Links related to the page" }
  },
  required: ["id", "title", "status", "spaceId", "createdAt", "version", "body", "bodyType", "_links"]
};

/**
 * Schema for Confluence pages list
 */
export const pagesListSchema = {
  type: "object",
  properties: {
    metadata: standardMetadataSchema,
    pages: {
      type: "array",
      items: pageSchema
    },
    spaceKey: { type: "string", description: "Space key", nullable: true }
  },
  required: ["metadata", "pages"]
};

/**
 * Schema for Confluence comment
 */
export const commentSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Comment ID" },
    pageId: { type: "string", description: "Page ID" },
    body: { type: "string", description: "Comment content (HTML)" },
    bodyType: { type: "string", description: "Content representation type" },
    createdAt: { type: "string", format: "date-time", description: "Creation date" },
    createdBy: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "Author's account ID" },
        displayName: { type: "string", description: "Author's display name" }
      }
    },
    _links: { type: "object", description: "Links related to the comment" }
  },
  required: ["id", "pageId", "body", "createdAt", "createdBy"]
};

/**
 * Schema for Confluence comments list
 */
export const commentsListSchema = {
  type: "object",
  properties: {
    metadata: standardMetadataSchema,
    comments: {
      type: "array",
      items: commentSchema
    },
    pageId: { type: "string", description: "Page ID" }
  },
  required: ["metadata", "comments", "pageId"]
};

/**
 * Schema for Confluence search results
 */
export const searchResultSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Content ID" },
    title: { type: "string", description: "Content title" },
    type: { type: "string", description: "Content type (page, blogpost, etc.)" },
    spaceKey: { type: "string", description: "Space key" },
    url: { type: "string", description: "Content URL" },
    excerpt: { type: "string", description: "Content excerpt with highlights" }
  },
  required: ["id", "title", "type", "spaceKey"]
};

/**
 * Schema for Confluence search results list
 */
export const searchResultsListSchema = {
  type: "object",
  properties: {
    metadata: standardMetadataSchema,
    results: {
      type: "array",
      items: searchResultSchema
    },
    cql: { type: "string", description: "CQL query used for the search" }
  },
  required: ["metadata", "results"]
};

// Label schemas
export const labelSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Label ID" },
    name: { type: "string", description: "Label name" },
    prefix: { type: "string", description: "Label prefix" }
  }
};

export const labelListSchema = {
  type: "object",
  properties: {
    labels: {
      type: "array",
      items: labelSchema
    },
    metadata: standardMetadataSchema
  }
};

// Attachment schemas
export const attachmentSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Attachment ID" },
    title: { type: "string", description: "Attachment title" },
    filename: { type: "string", description: "File name" },
    mediaType: { type: "string", description: "Media type" },
    fileSize: { type: "number", description: "File size in bytes" },
    downloadUrl: { type: "string", description: "Download URL" }
  }
};

export const attachmentListSchema = {
  type: "object",
  properties: {
    attachments: {
      type: "array",
      items: attachmentSchema
    },
    metadata: standardMetadataSchema
  }
};

// Version schemas
export const versionSchema = {
  type: "object",
  properties: {
    number: { type: "number", description: "Version number" },
    by: { 
      type: "object", 
      properties: {
        displayName: { type: "string" },
        accountId: { type: "string" }
      }
    },
    when: { type: "string", description: "Creation date" },
    message: { type: "string", description: "Version message" }
  }
};

export const versionListSchema = {
  type: "object",
  properties: {
    versions: {
      type: "array",
      items: versionSchema
    },
    metadata: standardMetadataSchema
  }
};

export const createPageSchema = z.object({
  spaceId: z.string().describe('Space ID (required, must be the numeric ID from API v2, NOT the key like TX, DEV, ...)'),
  title: z.string().describe('Title of the page (required)'),
  content: z.string().describe(`Content of the page (required, must be in Confluence storage format - XML-like HTML).

- Plain text or markdown is NOT supported (will throw error).
- Only XML-like HTML tags, Confluence macros (<ac:structured-macro>, <ac:rich-text-body>, ...), tables, panels, info, warning, etc. are supported if valid storage format.
- Content MUST strictly follow Confluence storage format.

Valid examples:
- <p>This is a paragraph</p>
- <ac:structured-macro ac:name="info"><ac:rich-text-body>Information</ac:rich-text-body></ac:structured-macro>
`),
  parentId: z.string().describe('Parent page ID (required, must specify the parent page to create a child page)')
}); 