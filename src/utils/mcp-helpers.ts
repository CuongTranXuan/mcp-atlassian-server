/**
 * Helper functions for MCP resources and tools
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpResponse, createJsonResponse, createErrorResponse, createSuccessResponse } from './mcp-core.js';
import { ApiError, ApiErrorType } from './error-handler.js';
import { AtlassianConfig } from './atlassian-api-base.js';
import { Logger } from './logger.js';
import { StandardMetadata, createStandardMetadata } from '../schemas/common.js';

const logger = Logger.getLogger('MCPHelpers');

/**
 * Environment and configuration utilities
 */
export namespace Config {
  /**
   * Get Atlassian configuration from environment variables
   */
  export function getAtlassianConfigFromEnv(): AtlassianConfig {
    const ATLASSIAN_SITE_NAME = process.env.ATLASSIAN_SITE_NAME || '';
    const ATLASSIAN_USER_EMAIL = process.env.ATLASSIAN_USER_EMAIL || '';
    const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || '';

    if (!ATLASSIAN_SITE_NAME || !ATLASSIAN_USER_EMAIL || !ATLASSIAN_API_TOKEN) {
      logger.error('Missing Atlassian credentials in environment variables');
      throw new Error('Missing Atlassian credentials in environment variables');
    }

    return {
      baseUrl: ATLASSIAN_SITE_NAME.includes('.atlassian.net') 
        ? `https://${ATLASSIAN_SITE_NAME}` 
        : ATLASSIAN_SITE_NAME,
      email: ATLASSIAN_USER_EMAIL,
      apiToken: ATLASSIAN_API_TOKEN
    };
  }

  /**
   * Helper to get Atlassian config from context or environment
   */
  export function getConfigFromContextOrEnv(context: any): AtlassianConfig {
    if (context?.atlassianConfig) {
      return context.atlassianConfig;
    }
    return getAtlassianConfigFromEnv();
  }
}

/**
 * Resource helper functions
 */
export namespace Resources {
  /**
   * Create a standardized resource response with metadata and schema
   */
  export function createStandardResource(
    uri: string,
    data: any[],
    dataKey: string,
    schema: any,
    totalCount: number,
    limit: number,
    offset: number,
    uiUrl?: string
  ): McpResponse {
    // Create standard metadata
    const metadata = createStandardMetadata(totalCount, limit, offset, uri, uiUrl);
    
    // Create response data object
    const responseData: Record<string, any> = {
      metadata: metadata
    };
    
    // Add the data with the specified key
    responseData[dataKey] = data;
    
    // Return formatted resource
    return createJsonResponse(uri, responseData);
  }

  /**
   * Extract paging parameters from resource URI or request
   */
  export function extractPagingParams(
    params: any,
    defaultLimit: number = 20,
    defaultOffset: number = 0
  ): { limit: number, offset: number } {
    let limit = defaultLimit;
    let offset = defaultOffset;
    
    if (params) {
      // Extract limit
      if (params.limit) {
        const limitParam = Array.isArray(params.limit) ? params.limit[0] : params.limit;
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = parsedLimit;
        }
      }
      // Extract offset
      if (params.offset) {
        const offsetParam = Array.isArray(params.offset) ? params.offset[0] : params.offset;
        const parsedOffset = parseInt(offsetParam, 10);
        if (!isNaN(parsedOffset) && parsedOffset >= 0) {
          offset = parsedOffset;
        }
      }
    }
    return { limit, offset };
  }
}

/**
 * Tool helper functions
 */
export namespace Tools {
  /**
   * Standardized response structure for MCP tools
   */
  export interface ToolResponse<T = any> {
    contents: Array<{
      mimeType: string;
      text: string;
    }>;
    isError?: boolean;
  }

  /**
   * Create a standardized response for MCP tools
   */
  export function createToolResponse<T = any>(success: boolean, message?: string, data?: T): ToolResponse<T> {
    const response = {
      success,
      ...(message && { message }),
      ...(data && { data })
    };
    return {
      contents: [
        {
          mimeType: 'application/json',
          text: JSON.stringify(response)
        }
      ]
    };
  }

  /**
   * Higher-order function to wrap a tool implementation with standardized error handling
   */
  export function wrapWithErrorHandling<T, P>(
    toolName: string,
    handler: (params: P) => Promise<T>
  ): (params: P) => Promise<ToolResponse<T>> {
    return async (params: P): Promise<ToolResponse<T>> => {
      try {
        // Execute the handler
        const result = await handler(params);
        // Return successful response with data
        return createToolResponse<T>(true, `${toolName} executed successfully`, result);
      } catch (error) {
        // Log the error
        logger.error(`Error executing tool ${toolName}:`, error);
        // Create appropriate error message
        let errorMessage: string;
        if (error instanceof ApiError) {
          errorMessage = error.message;
        } else {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        // Return standardized error response
        return createToolResponse(false, errorMessage);
      }
    };
  }
} 