// Configuration for different environments
const CONFIG = {
  // Production configuration (PulseChain)
  production: {
    hexRewardsAddress: '0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B',
    hexAddress: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
    chainId: 369,
    networkName: 'PulseChain Mainnet'
  },
  
  // Hardhat test configuration
  hardhat: {
    hexRewardsAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    hexAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chainId: 31337,
    networkName: 'Hardhat Local'
  }
};

// Function to get current configuration based on network
async function getConfig() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdDecimal = parseInt(chainId, 16);
      
      // Return config based on chainId
      if (chainIdDecimal === 31337) {
        console.log('Using Hardhat configuration');
        return CONFIG.hardhat;
      } else {
        console.log('Using Production configuration');
        return CONFIG.production;
      }
    } catch (error) {
      console.error('Error getting chainId:', error);
      // Default to production if error
      return CONFIG.production;
    }
  }
  // Default to production if no ethereum provider
  return CONFIG.production;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getConfig };
}