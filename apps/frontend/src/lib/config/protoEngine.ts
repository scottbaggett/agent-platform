/**
 * Proto Engine Configuration
 * Toggle between production execution engine and local prototype LangGraph server
 */

export const protoEngineConfig = {
  /**
   * Proto engine server URL
   * Default: http://localhost:8001
   */
  url: import.meta.env.VITE_API_URL || "http://localhost:8001",

  /**
   * Get the API URL based on whether proto engine is enabled
   */
  getApiUrl: () => {
    return import.meta.env.VITE_API_URL;
  },

  /**
   * Get nodes endpoint
   */
  getNodesEndpoint: () => {
    return `${import.meta.env.VITE_API_URL}/nodes`; // Replace with actual production endpoint
  },

  /**
   * Get execution endpoint
   */
  getExecutionEndpoint: () => {
    return `${import.meta.env.VITE_API_URL}/execute`; // Replace with actual production endpoint
  },

  /**
   * Get models endpoint
   */
  getModelsEndpoint: () => {
    return `${import.meta.env.VITE_API_URL}/models`; // Replace with actual production endpoint
  },
};
