
// Terminal CD frontend
// Terminal http-server

const contractAddress = '0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B'; // Replace with your contract address  DEV Address:0x8Aed6FE10dF3d6d981B101496C9c7245AE65cAEc  // Real HexRewards:0xCfCb89f00576A775d9f81961A37ba7DCf12C7d9B
const MAX_STAKES_PER_TIER = 369;

let web3, contract, accounts, abi;

async function loadABI() {
    try {
      const response = await fetch('./HexRewards.json');
      const HexRewardsArtifact = await response.json();
      abi = HexRewardsArtifact.abi;
    } catch (error) {
      console.error('Error loading HexRewards ABI:', error);
    }
  }

  
async function connectToMetaMask() {
  await loadABI();

  if (typeof window.ethereum !== 'undefined') {
    web3 = new Web3(window.ethereum);
    try {
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      contract = new web3.eth.Contract(abi, contractAddress);
      document.getElementById('accountInfo').innerHTML = `Connected: ${accounts[0]}`;
      await getTokenBalance();
      document.getElementById('mainContent').style.display = 'block'; // Show the main content
      document.getElementById('tokenBalanceHeader').style.display = 'block';
      document.getElementById('connectButton').style.display = 'none';
      document.getElementById('connectAddr').style.display = 'block';

      await getNetwork();
      await getStakeList();
      await displayRemainingSeats();

      // Store the connection status in localStorage
      localStorage.setItem('isMetaMaskConnected', 'true');
    } catch (error) {
      console.error(error);
    }
  } else {
    alert('Please install MetaMask to interact with this dApp!');
  }
}

async function checkAndConnectToMetaMask() {
  const isConnected = localStorage.getItem('isMetaMaskConnected');
  if (isConnected === 'true') {
    await connectToMetaMask();
  }
}

async function getTotalTokenSupply() {
    try {
        const totalSupply = await contract.methods.totalSupply().call();
        const formattedTotalSupply = parseFloat(web3.utils.fromWei(totalSupply, 'ether')).toFixed(8);
        document.getElementById('totalTokenSupply').innerHTML = `Total HexReward Supply: ${formattedTotalSupply}`;
    } catch (error) {
        console.error('Failed to fetch total token supply:', error);
    }
}

async function getTokenBalance() {
    try {
        const tokenAddress = contractAddress; 
        const tokenContract = new web3.eth.Contract(abi, tokenAddress);
        const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
        const formattedBalance = parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(8);
        document.getElementById('tokenBalance').innerHTML = `Your HexReward Balance: ${formattedBalance}`;
        await getTotalTokenSupply();  // Fetch and display total supply
    } catch (error) {
        console.error(error);
        alert('Failed to retrieve token balance. Please check the console for more information.');
    }
}

async function getNetwork(){
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
      // Access the MetaMask provider
      const ethereum = window.ethereum;

      // Retrieve the network ID
      ethereum.request({ method: 'net_version' })
        .then(networkId => {
          // Map network ID to network name
          let networkName;
          switch (networkId) {
            case '1':
              networkName = 'Mainnet';
              break;
            case '3':
              networkName = 'Ropsten';
              break;
            case '4':
              networkName = 'Rinkeby';
              break;
            case '5':
              networkName = 'Goerli';
              break;
            case '42':
              networkName = 'Kovan';
              break;
            case '369':
              networkName = 'PulseChain Mainnet';
              break;  
            case '943':
              networkName = 'PulseChain Testnet v4';
              break;  
            default:
              networkName = 'Unknown';
          }
          document.getElementById('networkInfo').innerHTML = `Connected: ${networkName}`;
          // Display network name in your DApp's UI
          console.log('Connected to ' + networkName);
        })
        .catch(error => {
          console.error('Error fetching network ID:', error);
        });
    } else {
      console.error('MetaMask is not installed');
    }
}

async function claimReward(stakeIndex) {
    try {
      await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
      alert('Reward claimed successfully!');
      await getTokenBalance(); // Refresh token balance in the header
      await getStakeList(); // Refresh the stake list in the grid
    } catch (error) {
      console.error(error);
      alert('Failed to claim reward. Please check the console for more information.');
    }
}

async function returnReward(stakeIndex, amtReturned) {
    const amount = amtReturned;
    try {
      const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
        
      if (BigInt(currentBalance) > BigInt(amount)) {
          await contract.methods.returnReward(stakeIndex, amount).send({ from: accounts[0] });
          alert('Reward returned successfully!');
          await getTokenBalance(); // Refresh token balance in the header
          await getStakeList(); // Refresh the stake list in the grid
      } else {
          alert('Insufficient balance to return the reward.');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to return reward. Please check the console for more information.');
    }
}

async function getRemainingSeats() {
    try {
        const remainingSeats = [];
        for (let i = 0; i < 9; i++) {
            const tierCount = await contract.methods.tierStakesCount(i).call();
            remainingSeats.push(MAX_STAKES_PER_TIER - Number(tierCount));
        }
        return remainingSeats;
    } catch (error) {
        console.error('Failed to fetch remaining seats:', error);
        return [];
    }
}

async function getStakeList() {
    console.log('Calling getStakeList function...');
    try {
      //const stakeListSpinner = document.getElementById('stakeListSpinner');
      //stakeListSpinner.style.display = 'block';

      const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
      console.log('Stake list retrieved:', theStakeList);
      displayStakeList(theStakeList);

      //stakeListSpinner.style.display = 'none';
    } catch (error) {
      console.error('Error retrieving stake list:', error);
      alert('Failed to retrieve stake list. Please check the console for more information.');
    }
  }

async function displayRemainingSeats() {
    const tierListElement = document.getElementById('tierList');
    tierListElement.innerHTML = '';

    const remainingSeats = await getRemainingSeats();
    const tierRanges = [
        '1,000 - 9,999',
        '10,000 - 99,999',
        '100,000 - 999,999',
        '1,000,000 - 9,999,999',
        '10,000,000 - 99,999,999',
        '100,000,000 - 999,999,999',
        '1,000,000,000 - 9,999,999,999',
        '10,000,000,000 - 99,999,999,999',
        '100,000,000,000+'
    ];

    const remainingSeatsElement = document.createElement('table');
    remainingSeatsElement.classList.add('tier-info');
    const headerRow = document.createElement('tr');
    const headers = ['Tier', 'Hex Stake Size Range', 'Hex Stakes (Seats) Left to Register'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    remainingSeatsElement.appendChild(headerRow);

    for (let i = 0; i < 9; i++) {
        const tierRow = document.createElement('tr');
        const tierCell = document.createElement('td');
        tierCell.textContent = `Tier ${i}`;
        const rangeCell = document.createElement('td');
        rangeCell.textContent = tierRanges[i];
        const seatsCell = document.createElement('td');
        seatsCell.textContent = remainingSeats[i];

        tierRow.appendChild(tierCell);
        tierRow.appendChild(rangeCell);
        tierRow.appendChild(seatsCell);
        remainingSeatsElement.appendChild(tierRow);
    }

    tierListElement.appendChild(remainingSeatsElement);
}

async function displayStakeList(stakeList) {
  const stakeListElement = document.getElementById('stakeList');
  stakeListElement.innerHTML = '';

  if (stakeList.length === 0) {
    stakeListElement.innerHTML = '<p>No stakes found.</p>';
    return;
  }

  const stakesPerPage = 10;
  const totalPages = Math.ceil(stakeList.length / stakesPerPage);

  let currentPage = 1;

  async function showPage(page) {
    currentPage = page;
    const startIndex = (page - 1) * stakesPerPage;
    const endIndex = startIndex + stakesPerPage;
    const stakesToShow = stakeList.slice(startIndex, endIndex);

    // Clear the stake list element
    stakeListElement.innerHTML = '';

    // Create and show the spinner
    const spinnerContent = document.getElementById('spinnerContent');
    spinnerContent.style.display = 'block';
    const stakeListSpinner = document.getElementById('stakeListSpinner');
    stakeListSpinner.style.display = 'block';

    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    const headers = ['Stake ID', 'Staked Hearts', 'Stake Shares', 'Locked Day', 'Staked Days', 'Unlocked Day', 'Auto Stake', 'Consumed Days', 'Early Reward', 'Finished Reward', 'Claimed Reward', 'Register', 'Claim Reward', 'Good Accounting (for 10x Bonus)', 'Return Reward'];

    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    const rowPromises = stakesToShow.map(async (stake, index) => {
    const consumedDays = await contract.methods.calculateConsumedDays(stake.lockedDay, stake.stakedDays).call();

    let claimedReward, earlyReward, finishedReward, returnAmt;

    const globalIndex = parseInt(startIndex + index); // Pre-calculate the index
    
    try {
      claimedReward = await contract.methods.getClaimedReward(accounts[0], globalIndex).call();
    } catch (error) {
      console.error('Error retrieving claimed reward:', error);
      claimedReward = '0';
    }
    
    try {
      earlyReward = await contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call();
    } catch (error) {
      console.error('Error retrieving early reward:', error);
      earlyReward = '0';
    }
    
    try {
      finishedReward = await contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call();
    } catch (error) {
      console.error('Error retrieving finished reward:', error);
      finishedReward = '0';
    }
    
    try {
      console.log(`Calculating return amount for stake index: ${globalIndex}`);
      returnAmt = await contract.methods.calculateReturnAmount(globalIndex).call();
      console.log(`Return amount: ${returnAmt}`);
    } catch (error) {
      console.error('Error retrieving return amount:', error);
      returnAmt = '0';
    }



      const row = document.createElement('tr');
      const values = [
        stake.stakeId,
        stake.stakedHearts,
        stake.stakeShares,
        stake.lockedDay,
        stake.stakedDays,
        stake.unlockedDay,
        stake.isAutoStake,
        consumedDays,
        web3.utils.fromWei(earlyReward, 'ether'),
        web3.utils.fromWei(finishedReward, 'ether'),
        web3.utils.fromWei(claimedReward, 'ether')
      ];

      values.forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        row.appendChild(td);
      });

      // Register button logic
      const registerTd = document.createElement('td');
      const isStakeRegistered = await contract.methods.isStakeRegistered(stake.stakeId).call();
      const tierIndex = await contract.methods.determineTier(stake.stakedHearts).call();
      let tierStakesCount = 0n;
      if (tierIndex < 9n){
        tierStakesCount = await contract.methods.tierStakesCount(tierIndex).call();
      } 
      let registerButtonDisplayed = false;

      if (!isStakeRegistered && stake.stakeId > await contract.methods.STAKEID_PROTECTION().call() && tierStakesCount < 369 && tierIndex < 9n) {
        const registerButton = document.createElement('button');
        registerButton.textContent = 'Register';
        registerButton.addEventListener('click', async () => {
          await contract.methods.claimStake(startIndex + index).send({ from: accounts[0] });
          await getStakeList();
          await displayRemainingSeats();
        });
        registerTd.appendChild(registerButton);
        registerButtonDisplayed = true;
      }
      row.appendChild(registerTd);

      // Claim button logic
      const claimTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() === '0' && ( ( stake.stakeId >= 817340 && tierIndex < 9n ) || ( stake.stakeId < 817340 ) )) {
        const claimButton = document.createElement('button');
        claimButton.textContent = 'Claim';
        claimButton.addEventListener('click', async () => {
          await claimReward(startIndex + index);
        });
        claimTd.appendChild(claimButton);
      }
      row.appendChild(claimTd);

      // Good Accounting button logic
      const goodAccountingTd = document.createElement('td');
      if (!registerButtonDisplayed && BigInt(claimedReward) == 0n && stake.unlockedDay == 0n && consumedDays >= stake.stakedDays) {
        const goodAccountingButton = document.createElement('button');
        goodAccountingButton.textContent = 'Good Accounting';
        goodAccountingButton.addEventListener('click', async () => {
          await callGoodAccounting(stake.stakeId, startIndex + index);
        });
        goodAccountingTd.appendChild(goodAccountingButton);
      }
      row.appendChild(goodAccountingTd);

      // Return button logic
      const returnTd = document.createElement('td');
      if (!registerButtonDisplayed && claimedReward.toString() !== '0') {
        const returnButton = document.createElement('button');

        // Calculate the return amount based on stake days consumed and stake length
        const stakeLength = Number(stake.stakedDays);
        const returnRate = stakeLength === 5555 ? 0.0001 : 0.00001;
        const returnAmount = (Number(consumedDays) * returnRate * 1.3).toFixed(8);

        returnButton.textContent = `Return HXR fee: ${returnAmount}`;

        returnButton.addEventListener('click', async () => {
          const contractReturnAmount = returnAmt; // await contract.methods.calculateReturnAmount(startIndex + index).call();
          await returnReward(parseInt(startIndex + index), contractReturnAmount);
        });

        returnTd.appendChild(returnButton);
      }
      row.appendChild(returnTd);

      return row;
    });

    const rows = await Promise.all(rowPromises);
    rows.forEach(row => table.appendChild(row));

    stakeListElement.appendChild(table);

    // Create pagination buttons
    const paginationElement = document.createElement('div');
    paginationElement.classList.add('pagination');

    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.addEventListener('click', () => showPage(i));
      if (i === currentPage) {
        button.classList.add('active');
      }
      paginationElement.appendChild(button);
    }

    stakeListElement.appendChild(paginationElement);

    // Remove the spinner after the table is fully populated
    stakeListSpinner.style.display = 'none';
    spinnerContent.style.display = 'none';
  }

  showPage(currentPage);
}
 

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

async function callGoodAccounting(stakeId, stakeIndex) {
  try {
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) {
      throw new Error('Failed to load Hex ABI.');
    }
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({ from: accounts[0] });
    alert('Good Accounting called successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to call Good Accounting. Please check the console for more information.');
  }
}
  
async function addTokenToMetaMask() {
    try {
      const tokenAddress = contractAddress;
      const tokenSymbol = 'HXR';
      const tokenDecimals = 18;
      const tokenImage = './logo-nobackground-1000.png';
  
      const wasAdded = await ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            image: tokenImage,
          },
        },
      });
  
      if (wasAdded) {
        console.log('Token added to MetaMask');
      } else {
        console.log('Token not added to MetaMask');
      }
    } catch (error) {
      console.error(error);
    }
  }  


async function addHexTokenToMetaMask() {
  try {
    const tokenAddress = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';
    const tokenSymbol = 'HEX';
    const tokenDecimals = 8;
    const tokenImage = './HEXagon.png';

    const wasAdded = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: tokenAddress,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
          image: tokenImage,
        },
      },
    });

    if (wasAdded) {
      console.log('Token added to MetaMask');
    } else {
      console.log('Token not added to MetaMask');
    }
  } catch (error) {
    console.error(error);
  }
}  


document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
document.getElementById('addHexTokenButton').addEventListener('click', addHexTokenToMetaMask);

// Call the checkAndConnectToMetaMask function when the page loads
window.addEventListener('load', checkAndConnectToMetaMask);
