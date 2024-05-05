const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'; // Replace with the actual Hex contract address

let web3, hexContract, accounts;

async function loadHexABI() {
  try {
    const response = await fetch('./HexABI.json');
    const hexAbi = await response.json();
    return hexAbi;
  } catch (error) {
    console.error('Error loading Hex ABI:', error);
    return null;
  }
}

async function connectToMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
      web3 = new Web3(window.ethereum);
      try {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        document.getElementById('accountInfo').innerHTML = `Connected: ${accounts[0]}`;
        document.getElementById('connectButton').style.display = 'none';
  
        // Load Hex ABI and initialize hexContract
        const hexAbi = await loadHexABI();
        if (!hexAbi) {
          throw new Error('Failed to load Hex ABI.');
        }
        hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);
  
        // Call read-only functions
        await getTotalSupply();
        await getHexBalance(accounts[0]);
        await getCurrentDay();
        await getStakeCount(accounts[0]);
      } catch (error) {
        console.error(error);
      }
    } else {
      alert('Please install MetaMask to interact with this dApp!');
    }
  }

  async function createStake() {
    const stakeAmount = document.getElementById('stakeAmount').value;
    const stakeDays = document.getElementById('stakeDays').value;
  
    if (!stakeAmount || !stakeDays) {
      alert('Please enter the stake amount and duration.');
      return;
    }
  
    try {
      const hexToStake = parseFloat(stakeAmount);
      const heartsToStake = BigInt(hexToStake * 10 ** 8);
  
      await hexContract.methods.stakeStart(heartsToStake, stakeDays).send({ from: accounts[0] });
  
      document.getElementById('transactionStatus').innerHTML = 'Stake created successfully!';
  
      // Refresh stake count after creating a new stake
      await getStakeCount(accounts[0]);
    } catch (error) {
      console.error(error);
      document.getElementById('transactionStatus').innerHTML = 'Failed to create stake. Please check the console for more information.';
    }
  }

async function getTotalSupply() {
    try {
      const totalSupply = await hexContract.methods.totalSupply().call();
      const formattedTotalSupply = web3.utils.fromWei(totalSupply, 'gwei') * 10;
      console.log('Total HEX Supply:', formattedTotalSupply);
    } catch (error) {
      console.error('Error retrieving total supply:', error);
    }
  }
  
  async function getHexBalance(address) {
    try {
      const balance = await hexContract.methods.balanceOf(address).call();
      const formattedBalance = web3.utils.fromWei(balance, 'gwei') * 10;
      console.log('HEX Balance:', formattedBalance);
    } catch (error) {
      console.error('Error retrieving HEX balance:', error);
    }
  }

async function getCurrentDay() {
  try {
    const currentDay = await hexContract.methods.currentDay().call();
    console.log('Current Day:', currentDay);
  } catch (error) {
    console.error('Error retrieving current day:', error);
  }
}

async function getStakeCount(address) {
  try {
    const stakeCount = await hexContract.methods.stakeCount(address).call();
    console.log('Stake Count:', stakeCount);
  } catch (error) {
    console.error('Error retrieving stake count:', error);
  }
}

document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('createStakeButton').addEventListener('click', createStake);