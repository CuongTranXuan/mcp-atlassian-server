import { z } from 'zod';
import { callConfluenceApi } from '../../utils/atlassian-api-base.js';
import { AtlassianConfig } from '../../utils/atlassian-api-base.js';
import { ApiError, ApiErrorType } from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpResponse, createSuccessResponse, createErrorResponse } from '../../utils/mcp-core.js';
import { updateConfluencePageV2 } from '../../utils/confluence-tool-api.js';
import { Config } from '../../utils/mcp-helpers.js';

// Initialize logger
const logger = Logger.getLogger('ConfluenceTools:updatePage');

// Input parameter schema
export const updatePageSchema = z.object({
  pageId: z.string().describe('ID of the page to update'),
  title: z.string().optional().describe('New title of the page'),
  content: z.string().optional().describe(`New content of the page (Confluence storage format only, XML-like HTML).

- Plain text or markdown is NOT supported (will throw error).
- Only XML-like HTML tags, Confluence macros (<ac:structured-macro>, <ac:rich-text-body>, ...), tables, panels, info, warning, etc. are supported if valid storage format.
- Content MUST strictly follow Confluence storage format.

Valid examples:
- <p>This is a paragraph</p>
- <ac:structured-macro ac:name="info"><ac:rich-text-body>Information</ac:rich-text-body></ac:structured-macro>
`),
  version: z.number().describe('Current version number of the page (required to avoid conflicts)')
});

type UpdatePageParams = z.infer<typeof updatePageSchema>;

interface UpdatePageResult {
  id: string;
  title: string;
  version: number;
  self: string;
  webui: string;
  success: boolean;
  message: string;
}

// Main handler to update a page (API v2)
export async function updatePageHandler(
  params: UpdatePageParams,
  config: AtlassianConfig
): Promise<UpdatePageResult> {
  try {
    logger.info(`Updating page (v2) with ID: ${params.pageId}`);
    // Lấy version, title, content hiện tại nếu thiếu
    const baseUrl = config.baseUrl.endsWith('/wiki') ? config.baseUrl : `${config.baseUrl}/wiki`;
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'MCP-Atlassian-Server/1.0.0'
    };
    const url = `${baseUrl}/api/v2/pages/${encodeURIComponent(params.pageId)}`;
    const res = await fetch(url, { method: 'GET', headers, credentials: 'omit' });
    if (!res.ok) throw new Error(`Failed to get page info: ${params.pageId}`);
    const pageData = await res.json();
    let version = pageData.version.number + 1;
    let title = params.title ?? pageData.title;
    let content = params.content;
    if (!title) throw new Error('Missing title for page update');
    if (!content) {
      // Lấy body hiện tại nếu không truyền content
      const bodyRes = await fetch(`${url}/body`, { method: 'GET', headers, credentials: 'omit' });
      if (!bodyRes.ok) throw new Error(`Failed to get page body: ${params.pageId}`);
      const bodyData = await bodyRes.json();
      content = bodyData.value;
      if (!content) throw new Error('Missing content for page update');
    }
    // Gọi helper updateConfluencePageV2 với đủ trường
    const data = await updateConfluencePageV2(config, {
      pageId: params.pageId,
      title,
      content,
      version
    });
    return {
      id: data.id,
      title: data.title,
      version: data.version.number,
      self: data._links?.self || '',
      webui: data._links?.webui || '',
      success: true,
      message: 'Successfully updated page'
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Error updating page (v2) with ID ${params.pageId}:`, error);
    let message = `Failed to update page: ${error instanceof Error ? error.message : String(error)}`;
    throw new ApiError(
      ApiErrorType.SERVER_ERROR,
      message,
      500
    );
  }
}

// Register the tool with MCP Server
export const registerUpdatePageTool = (server: McpServer) => {
  server.tool(
    'updatePage',
    'Update the content and information of a Confluence page',
    updatePageSchema.shape,
    async (params: UpdatePageParams, context: Record<string, any>) => {
      try {
        const config = context?.atlassianConfig ?? Config.getAtlassianConfigFromEnv();
        if (!config) {
          return {
            content: [
              { type: 'text', text: 'Invalid or missing Atlassian configuration' }
            ],
            isError: true
          };
        }
        const result = await updatePageHandler(params, config);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: result.message,
                id: result.id,
                title: result.title,
                version: result.version,
                url: `${config.baseUrl}/wiki${result.webui}`
              })
            }
          ]
        };
      } catch (error) {
        if (error instanceof ApiError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: error.message,
                  code: error.code,
                  statusCode: error.statusCode,
                  type: error.type
                })
              }
            ],
            isError: true
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Error while updating page: ${error instanceof Error ? error.message : String(error)}`
              })
            }
          ],
          isError: true
        };
      }
    }
  );
}; 