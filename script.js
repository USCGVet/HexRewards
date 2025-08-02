// script.js

// Contract addresses will be set dynamically based on network
let contractAddress;
let hexContractAddress;
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
      // Get configuration based on current network
      const config = await getConfig();
      contractAddress = config.hexRewardsAddress;
      hexContractAddress = config.hexAddress;
      
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      contract = new web3.eth.Contract(abi, contractAddress);
      document.getElementById('accountInfo').innerHTML = `Connected: ${accounts[0]}`;
      document.getElementById('mainContent').style.display = 'block';
      document.getElementById('tokenBalanceHeader').style.display = 'block';
      document.getElementById('connectButton').style.display = 'none';
      document.getElementById('connectAddr').style.display = 'block';

      await getNetwork();
      await getTokenBalance();
      await getStakeList(); // <-- builds out your DataTable
      await displayRemainingSeats();

      localStorage.setItem('isMetaMaskConnected', 'true');
    } catch (error) {
      console.error(error);
    }
  } else {
    alert('Please install MetaMask to interact with this dApp!');
  }
}

async function getNetwork() {
  if (typeof window.ethereum !== 'undefined') {
    const ethereum = window.ethereum;
    ethereum
      .request({ method: 'net_version' })
      .then((networkId) => {
        let networkName;
        switch (networkId) {
          case '1': networkName = 'Mainnet'; break;
          case '3': networkName = 'Ropsten'; break;
          case '4': networkName = 'Rinkeby'; break;
          case '5': networkName = 'Goerli'; break;
          case '42': networkName = 'Kovan'; break;
          case '369': networkName = 'PulseChain Mainnet'; break;
          case '943': networkName = 'PulseChain Testnet v4'; break;
          case '31337': networkName = 'Hardhat Local'; break;
          default: networkName = 'Unknown';
        }
        document.getElementById('networkInfo').innerHTML = `Connected: ${networkName}`;
        console.log('Connected to ' + networkName);
      })
      .catch((error) => {
        console.error('Error fetching network ID:', error);
      });
  } else {
    console.error('MetaMask is not installed');
  }
}

async function getTokenBalance() {
  try {
    const tokenAddress = contractAddress;
    const tokenContract = new web3.eth.Contract(abi, tokenAddress);
    const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
    const formattedBalance = parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(8);
    document.getElementById('tokenBalance').innerHTML = `Your HexReward Balance: ${formattedBalance}`;

    const totalSupply = await contract.methods.totalSupply().call();
    const formattedTotalSupply = parseFloat(web3.utils.fromWei(totalSupply, 'ether')).toFixed(8);
    document.getElementById('totalTokenSupply').innerHTML = `Total HexReward Supply: ${formattedTotalSupply}`;
  } catch (error) {
    console.error(error);
    alert('Failed to retrieve token balance. Please check the console for more information.');
  }
}

/** 
 * --------------------
 *    MAIN CHANGE:
 * --------------------
 * In getStakeList(), BigInt fields (like stakeId, lockedDay, etc.) are converted to string or number 
 * before pushing into dataSet. This prevents DataTables from throwing "Cannot convert a BigInt value to a number."
 */
async function getStakeList() {
  console.log('Calling getStakeList function...');
  // Show spinner
  document.getElementById('spinnerContent').style.display = 'block';
  document.getElementById('stakeListSpinner').style.display = 'block';

  try {
    const theStakeList = await contract.methods.getStakeList(accounts[0]).call();
    console.log('Stake list retrieved:', theStakeList);

    if (!Array.isArray(theStakeList) || theStakeList.length === 0) {
      // Hide spinner
      document.getElementById('spinnerContent').style.display = 'none';
      document.getElementById('stakeListSpinner').style.display = 'none';

      // Initialize an empty DataTable so it doesn't break
      $('#stakeList').DataTable({
        data: [],
        columns: [
          { title: 'No Stakes Found.' }
        ]
      });
      return;
    }

    // Example: We'll gather seat info or similar logic here
    const seatsArray = await getRemainingSeats(); 

    // Now gather row objects
    const dataSet = [];

    for (let i = 0; i < theStakeList.length; i++) {
      const stake = theStakeList[i];

      // Convert BigInt fields to strings/numbers for display
      const stakeIdString = stake.stakeId.toString();
      const stakedHeartsStr = formatBigIntWithDecimals(stake.stakedHearts, 8, 3);
      const stakeSharesStr  = formatBigIntWithDecimals(stake.stakeShares, 9, 3);
      const lockedDayInt    = Number(stake.lockedDay);
      const stakedDaysInt   = Number(stake.stakedDays);
      const unlockedDayInt  = Number(stake.unlockedDay);

      // Additional read-only calls
      const consumedDays  = await contract.methods
        .calculateConsumedDays(stake.lockedDay, stake.stakedDays)
        .call();

      const claimedReward = await safeCall(
        contract.methods.getClaimedReward(accounts[0], i).call(),
        '0'
      );
      const earlyReward   = await safeCall(
        contract.methods.calculateReward(consumedDays, stake.stakedDays, stake.unlockedDay).call(),
        '0'
      );
      const finishedReward = await safeCall(
        contract.methods.calculateReward(stake.stakedDays, stake.stakedDays, 1).call(),
        '0'
      );

      // Convert to decimal strings
      const earlyRewardNum    = parseFloat(web3.utils.fromWei(earlyReward, 'ether')).toFixed(8);
      const finishedRewardNum = parseFloat(web3.utils.fromWei(finishedReward, 'ether')).toFixed(8);
      const claimedRewardNum  = parseFloat(web3.utils.fromWei(claimedReward, 'ether')).toFixed(8);

      // Booleans
      const isClaimed    = Number(claimedReward) > 0;
      const isRegistered = await safeCall(
        contract.methods.isStakeRegistered?.(stake.stakeId).call(),
        false
      );

      // Tier logic
      const stakedHeartsBigInt = BigInt(stake.stakedHearts);
      const stakeTier          = calculateTierFromHearts(stakedHeartsBigInt);
      const seatsAvailable     = seatsArray[stakeTier] > 0;
      
      // Push to dataSet
      dataSet.push({
        index: i,
        stakeId: stakeIdString,
        stakedHearts: stakedHeartsStr,
        stakeShares: stakeSharesStr,
        lockedDay: lockedDayInt,
        stakedDays: stakedDaysInt,
        unlockedDay: unlockedDayInt,
        consumedDays: Number(consumedDays),
        earlyReward: earlyRewardNum,
        finishedReward: finishedRewardNum,
        claimedReward: claimedRewardNum,  // stays here for display in the Claim column
        isClaimed,
        isRegistered,
        seatsAvailable,
        stakeTier,
      });
    }

    // Hide spinner
    document.getElementById('stakeListSpinner').style.display = 'none';
    document.getElementById('spinnerContent').style.display = 'none';

    // (Re)Initialize DataTable
    if ($.fn.DataTable.isDataTable('#stakeList')) {
      $('#stakeList').DataTable().destroy();
    }
    $('#stakeList').empty(); // Clear out old table header/footer

    $('#stakeList').DataTable({
      data: dataSet,
      columns: [
        { data: 'index',          title: 'Stake Index' },
        { data: 'stakeId',        title: 'Stake ID' },
        { data: 'stakedHearts',   title: 'Staked Hex' },
        { data: 'stakeShares',    title: 'Stake B-Shares' },
        { data: 'lockedDay',      title: 'Locked Day' },
        { data: 'stakedDays',     title: 'Staked Days' },
        { data: 'consumedDays',   title: 'Consumed Days' },
        { data: 'earlyReward',    title: 'Early Reward' },
        { data: 'finishedReward', title: 'Finished Reward' },
        // Removed the separate "Claimed Reward" column
        {
          title: 'Register',
          data: null,
          render: function(data, type, row) {
            const heartsNum  = parseFloat(row.stakedHearts);
            const stakeIdNum = parseFloat(row.stakeId);

            if (heartsNum < 1000) {
              return 'Not Allowed';
            } else if (stakeIdNum < 817340) {
              return 'Not Needed';
            } else if (row.isRegistered) {
              return 'Registered';
            } else if (!row.seatsAvailable) {
              return 'No Seats Left';
            } else {
              return `<button class="register-btn" data-stake-index="${row.index}">Register</button>`;
            }
          },
        },
        {
          title: 'Claim',
          data: null,
          render: function(data, type, row) {
            const heartsNum  = parseFloat(row.stakedHearts);
            const stakeIdNum = parseFloat(row.stakeId);

            if (heartsNum < 1000) {
              return 'Not Allowed';
            } else if (row.isClaimed) {
              // Display the claimed amount here
              return `Claimed<br/><span class="small-amount">${row.claimedReward}</span>`;
            } else if (stakeIdNum < 817340) {
              // For older stake IDs
              return `<button class="claim-btn" data-stake-index="${row.index}">Claim</button>`;
            } else {
              // Must be registered first
              return row.isRegistered
                ? `<button class="claim-btn" data-stake-index="${row.index}">Claim</button>`
                : 'Not Registered';
            }
          }
        },
        {
          title: 'Return',
          data: null,
          render: function(data, type, row) {
            if (!row.isClaimed) {
              return 'Not Claimed';
            }
            try {
              const earlyRewardWei     = web3.utils.toWei(row.earlyReward, 'ether');
              const requiredReturnWei  = (BigInt(earlyRewardWei) * 130n) / 100n;
              const requiredReturnHXR  = parseFloat(
                web3.utils.fromWei(requiredReturnWei.toString(), 'ether')
              ).toFixed(4);

              return `
                <div class="return-cell">
                  <button 
                    class="return-btn" 
                    data-stake-index="${row.index}" 
                    data-early-reward="${row.earlyReward}"
                  >
                    Return
                  </button>
                  <div class="small-amount">
                    Needs ~${requiredReturnHXR} HXR
                  </div>
                </div>
              `;
            } catch (err) {
              console.error('Error calculating Return HXR:', err);
              return `
                <button class="return-btn" data-stake-index="${row.index}" data-early-reward="${row.earlyReward}">
                  Return
                </button>
              `;
            }
          }
        },
        {
          title: 'Good Accounting',
          data: null,
          render: function(data, type, row) {
            if (row.unlockedDay && row.unlockedDay > 0) {
              return 'GA Done';
            } else {
              return `
                <button
                  class="ga-btn"
                  data-stake-index="${row.index}"
                  data-stake-id="${row.stakeId}"
                >
                  GA
                </button>
              `;
            }
          }
        },
        {
          title: 'End Stake',
          data: null,
          render: function(data, type, row) {
            return `
              <button
                class="end-btn"
                data-stake-index="${row.index}"
                data-stake-id="${row.stakeId}"
              >
                End
              </button>
            `;
          }
        },
      ],
      pageLength: 10,
      responsive: true
    });

    // Wire up the button clicks (delegate events)
    wireUpTableButtons();

  } catch (error) {
    console.error('Error retrieving stake list:', error);
    alert('Failed to retrieve stake list. Please check the console for more info.');
    // Hide spinner
    document.getElementById('stakeListSpinner').style.display = 'none';
    document.getElementById('spinnerContent').style.display = 'none';
  }
}


function wireUpTableButtons() {
  // The table's ID is stakeList
  const table = $('#stakeList');

  // Register
  table.off('click', '.register-btn').on('click', '.register-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    try {
      await contract.methods.claimStake(stakeIndex).send({ from: accounts[0] });
      alert('Stake successfully registered!');
      await getStakeList(); // Refresh the table
      await displayRemainingSeats();
    } catch (err) {
      console.error('Error registering stake:', err);
      alert('Registration failed. Check console for details.');
    }
  });

  // Claim
  table.off('click', '.claim-btn').on('click', '.claim-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    try {
      await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
      alert('Reward claimed successfully!');
      await getTokenBalance();
      await getStakeList();
    } catch (err) {
      console.error(err);
      alert('Failed to claim reward. Check console for more information.');
    }
  });

  // Return
  table.off('click', '.return-btn').on('click', '.return-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const rawEarlyReward = $(this).data('earlyReward'); // from the row
    try {
      const earlyRewardWei = web3.utils.toWei(rawEarlyReward, 'ether');
      const returnAmountWei = (BigInt(earlyRewardWei) * BigInt(130n)) / BigInt(100n);
      const returnAmount = returnAmountWei.toString();

      const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
      if (BigInt(currentBalance) >= BigInt(returnAmount)) {
        await contract.methods.returnReward(stakeIndex, returnAmount).send({ from: accounts[0] });
        alert('Reward returned successfully!');
        await getTokenBalance();
        await getStakeList();
      } else {
        alert('Insufficient balance to return the reward.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to return reward. Check console for more info.');
    }
  });

  // Good Accounting (GA)
  table.off('click', '.ga-btn').on('click', '.ga-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const stakeId = $(this).data('stakeId');
    try {
      const hexAbi = await loadHexABI();
      if (!hexAbi) throw new Error('Failed to load Hex ABI.');
      const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

      await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({
        from: accounts[0],
      });
      alert('Good Accounting called successfully!');
      await getStakeList();
    } catch (error) {
      console.error(error);
      alert('Failed to call Good Accounting. Check console for info.');
    }
  });

  // End Stake
  table.off('click', '.end-btn').on('click', '.end-btn', async function () {
    const stakeIndex = $(this).data('stakeIndex');
    const stakeId = $(this).data('stakeId');
    
    // Define the actual end stake function
    window.proceedWithNormalEndStake = async () => {
      try {
        const hexAbi = await loadHexABI();
        if (!hexAbi) {
          alert('Failed to load Hex ABI');
          return;
        }
        const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

        await hexContract.methods.stakeEnd(stakeIndex, stakeId).send({ from: accounts[0] });
        alert('Stake ended successfully!');
        await getStakeList();
      } catch (error) {
        console.error(error);
        alert('Error ending stake. Check console for details.');
      }
    };
    
    // Get the DataTable instance and row data
    const dt = table.DataTable();
    const rowData = dt.row($(this).closest('tr')).data();
    const consumedDays = rowData.consumedDays;
    const stakedDays = rowData.stakedDays;
    
    // Get all stakes to check the last one
    const allStakes = dt.rows().data().toArray();
    const lastStakeIndex = allStakes.length - 1;
    
    // Check if ending this stake would cause a pop-swap that affects a valuable stake
    if (stakeIndex !== lastStakeIndex && allStakes.length > 1) {
      const lastStake = allStakes[lastStakeIndex];
      
      // Check if the last stake has HexRewards value (registered and not yet claimed)
      // OR if it's a large stake that could be registered
      const isLastStakeValuable = (lastStake.isRegistered && !lastStake.isClaimed) || 
                                  (!lastStake.isRegistered && parseFloat(lastStake.stakedHearts) >= 1000);
      
      if (isLastStakeValuable) {
        // Calculate minimum stake amount first
        let minStakeHex = "calculating...";
        try {
          const hexAbi = await loadHexABI();
          if (hexAbi) {
            const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);
            const globals = await hexContract.methods.globals().call();
            const shareRate = Number(globals.shareRate);
            const SHARE_RATE_SCALE = 100000;
            const minStakeHearts = Math.ceil(shareRate / SHARE_RATE_SCALE) + 1;
            minStakeHex = (minStakeHearts / 100000000).toFixed(8);
          }
        } catch (e) {
          minStakeHex = "~1";
        }
        
        // Show intervention warning
        const interventionHtml = `
          <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #FFA500;
            background: linear-gradient(135deg, #FFA500 0%, #FFD700 100%);
            border: 3px solid #FF6600;
            border-radius: 15px;
            padding: 30px;
            z-index: 10000;
            box-shadow: 0 0 50px rgba(255, 165, 0, 0.8);
            max-width: 500px;
            text-align: center;
          " id="popSwapWarning">
            <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 32px; text-shadow: 2px 2px 4px rgba(255,255,255,0.5);">
              🛡️ STAKE PROTECTION WARNING 🛡️
            </h2>
            <p style="color: #000000; font-size: 18px; margin: 10px 0; font-weight: bold;">
              Ending this stake will affect another valuable stake!
            </p>
            <div style="background: rgba(255,255,255,0.9); padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p style="color: #8B0000; font-size: 16px; margin: 5px 0;">
                <strong>Last Stake Details:</strong>
              </p>
              <p style="color: #000000; font-size: 14px; margin: 5px 0;">
                Stake ID: ${lastStake.stakeId}<br>
                Amount: ${lastStake.stakedHearts} HEX<br>
                Duration: ${lastStake.stakedDays} days<br>
                Potential Reward: ${lastStake.finishedReward} HXR
              </p>
            </div>
            <p style="color: #8B0000; font-size: 16px; margin: 15px 0; font-weight: bold;">
              This stake will be moved to index ${stakeIndex} and may lose reward eligibility!
            </p>
            <div style="background: rgba(255,255,255,0.9); padding: 20px; border-radius: 10px; margin: 15px 0;">
              <p style="color: #000000; font-size: 16px; margin: 5px 0; font-weight: bold;">
                💡 Solution: Create a sacrificial stake
              </p>
              <p style="color: #8B0000; font-size: 18px; margin: 5px 0; font-weight: bold;">
                Cost: ${minStakeHex} HEX for 1 day
              </p>
              <p style="color: #666666; font-size: 14px; margin: 5px 0 15px 0;">
                This tiny stake will protect your valuable stakes
              </p>
              <button onclick="window.createSacrificialStake()" style="
                background: #32CD32;
                color: #FFFFFF;
                border: none;
                padding: 12px 30px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                width: 100%;
                box-shadow: 0 4px 15px rgba(50, 205, 50, 0.3);
                transition: all 0.3s ease;
              "
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(50, 205, 50, 0.4)'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(50, 205, 50, 0.3)'">
                Create Sacrificial Stake
              </button>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: center;">
              <button onclick="document.getElementById('popSwapWarning').remove(); document.getElementById('popSwapWarningOverlay').remove()" style="
                background: #4169E1;
                color: #FFFFFF;
                border: none;
                padding: 12px 30px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                width: 140px;
                box-shadow: 0 3px 10px rgba(65, 105, 225, 0.3);
                transition: all 0.3s ease;
              "
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(65, 105, 225, 0.4)'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(65, 105, 225, 0.3)'">
                Cancel
              </button>
              <button onclick="window.proceedWithPopSwapEnd()" style="
                background: #DC143C;
                color: #FFFFFF;
                border: none;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                width: 180px;
                box-shadow: 0 3px 10px rgba(220, 20, 60, 0.3);
                transition: all 0.3s ease;
              "
              onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(220, 20, 60, 0.4)'"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(220, 20, 60, 0.3)'">
                ☠️ Continue End Stake
              </button>
            </div>
          </div>
          <div id="popSwapWarningOverlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
          " onclick="document.getElementById('popSwapWarning').remove(); document.getElementById('popSwapWarningOverlay').remove()"></div>
        `;
        
        $('body').append(interventionHtml);
        
        // Define the proceed function for pop-swap warning
        window.proceedWithPopSwapEnd = async () => {
          document.getElementById('popSwapWarning').remove();
          document.getElementById('popSwapWarningOverlay').remove();
          // Continue with the normal end stake process
          window.proceedWithNormalEndStake();
        };
        
        // Define function to create sacrificial stake
        window.createSacrificialStake = async () => {
          document.getElementById('popSwapWarning').remove();
          document.getElementById('popSwapWarningOverlay').remove();
          
          try {
            const hexAbi = await loadHexABI();
            if (!hexAbi) {
              alert('Failed to load Hex ABI');
              return;
            }
            const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);
            
            // Calculate minimum stake amount based on current shareRate
            // Formula: newStakeShares = (stakedHearts + bonusHearts) * SHARE_RATE_SCALE / shareRate
            // We need at least 1 share, and for 1-day stake, bonus is minimal
            
            const globals = await hexContract.methods.globals().call();
            const shareRate = Number(globals.shareRate);
            const SHARE_RATE_SCALE = 100000; // 1e5 from HEX contract
            
            // For minimum calculation, we need: stakedHearts >= shareRate / SHARE_RATE_SCALE
            // Add a small buffer to ensure we meet minimum
            const minStakeHearts = Math.ceil(shareRate / SHARE_RATE_SCALE) + 1;
            const stakeDays = 1;
            
            // Convert to HEX for display (8 decimals)
            const minStakeHex = (minStakeHearts / 100000000).toFixed(8);
            
            console.log(`Creating sacrificial stake: ${minStakeHex} HEX for 1 day (shareRate: ${shareRate})`);
            const tx = await hexContract.methods.stakeStart(minStakeHearts.toString(), stakeDays).send({ 
              from: accounts[0],
              gas: 500000 
            });
            
            alert('Sacrificial stake created! You can now safely end your stake.');
            await getStakeList();
          } catch (error) {
            console.error('Failed to create sacrificial stake:', error);
            alert('Failed to create sacrificial stake. Please try manually from the Stake Hex page.');
          }
        };
        
        return; // Stop here until user makes a choice
      }
    }
    
    // Check if stake has NOT served full term
    if (consumedDays < stakedDays) {
      // Show bright warning popup for early end stake
      const daysRemaining = stakedDays - consumedDays;
      const percentComplete = Math.floor((consumedDays / stakedDays) * 100);
      
      const warningHtml = `
        <div style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #FF0000;
          background: linear-gradient(135deg, #FF0000 0%, #FF6600 100%);
          border: 3px solid #FFFF00;
          border-radius: 15px;
          padding: 30px;
          z-index: 10000;
          box-shadow: 0 0 50px rgba(255, 0, 0, 0.8), 0 0 100px rgba(255, 102, 0, 0.6);
          max-width: 400px;
          text-align: center;
          animation: pulse 1.5s infinite;
        " id="earlyEndWarning">
          <style>
            @keyframes pulse {
              0% { box-shadow: 0 0 50px rgba(255, 0, 0, 0.8), 0 0 100px rgba(255, 102, 0, 0.6); }
              50% { box-shadow: 0 0 80px rgba(255, 0, 0, 1), 0 0 150px rgba(255, 102, 0, 0.8); }
              100% { box-shadow: 0 0 50px rgba(255, 0, 0, 0.8), 0 0 100px rgba(255, 102, 0, 0.6); }
            }
          </style>
          <h2 style="color: #FFFF00; margin: 0 0 20px 0; font-size: 36px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
            ⚠️ WARNING! ⚠️
          </h2>
          <h3 style="color: #FFFFFF; margin: 0 0 20px 0; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
            EARLY END STAKE PENALTY!
          </h3>
          <p style="color: #FFFFFF; font-size: 18px; margin: 10px 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
            This stake is only ${percentComplete}% complete!
          </p>
          <p style="color: #FFFF00; font-size: 20px; margin: 10px 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
            ${daysRemaining} days remaining
          </p>
          <p style="color: #FFFFFF; font-size: 16px; margin: 20px 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
            Ending early will result in SIGNIFICANT PENALTIES!
          </p>
          <div style="margin-top: 30px;">
            <button onclick="document.getElementById('earlyEndWarning').remove(); document.getElementById('earlyEndWarningOverlay').remove()" style="
              background: #00FF00;
              color: #000000;
              border: none;
              padding: 15px 30px;
              font-size: 18px;
              font-weight: bold;
              border-radius: 5px;
              cursor: pointer;
              margin: 0 10px;
              box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
            ">
              CANCEL - Keep Stake
            </button>
            <button onclick="window.proceedWithEndStake()" style="
              background: #8B0000;
              color: #FFFFFF;
              border: 2px solid #FF0000;
              padding: 15px 30px;
              font-size: 18px;
              font-weight: bold;
              border-radius: 5px;
              cursor: pointer;
              margin: 0 10px;
              box-shadow: 0 0 20px rgba(139, 0, 0, 0.5);
            ">
              END ANYWAY
            </button>
          </div>
        </div>
        <div id="earlyEndWarningOverlay" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 9999;
        " onclick="document.getElementById('earlyEndWarning').remove(); document.getElementById('earlyEndWarningOverlay').remove()"></div>
      `;
      
      // Add the warning to the page
      $('body').append(warningHtml);
      
      // Define the proceed function
      window.proceedWithEndStake = async () => {
        document.getElementById('earlyEndWarning').remove();
        document.getElementById('earlyEndWarningOverlay').remove();
        window.proceedWithNormalEndStake();
      };
    } else {
      // Stake is mature, proceed normally
      window.proceedWithNormalEndStake();
    }
  });
}
/**
 * Calculates which tier a stake belongs to based on its size in hearts.
 * Does *not* rely on contract logic; it’s purely front-end JavaScript.
 *
 * @param {BigInt} amountInHearts - The stake size in hearts as a BigInt.
 * @returns {number} Tier index from 0..8, or 9 if invalid (below 1,000).
 */
function calculateTierFromHearts(amountInHearts) {
  // Adjust these thresholds to match your actual tier logic:

  // For example, if 1,000 hearts is the minimum to even qualify (Tier 0):
  if (amountInHearts < 1_000n) {
    return 9; // “Invalid” or “Not in any tier”
  } else if (amountInHearts < 10_000n) {
    return 0; 
  } else if (amountInHearts < 100_000n) {
    return 1;
  } else if (amountInHearts < 1_000_000n) {
    return 2;
  } else if (amountInHearts < 10_000_000n) {
    return 3;
  } else if (amountInHearts < 100_000_000n) {
    return 4;
  } else if (amountInHearts < 1_000_000_000n) {
    return 5;
  } else if (amountInHearts < 10_000_000_000n) {
    return 6;
  } else if (amountInHearts < 100_000_000_000n) {
    return 7;
  } else {
    return 8;
  }
}


// Utility: safer call that returns a default if something fails
async function safeCall(promise, defaultValue) {
  try {
    return await promise;
  } catch (err) {
    console.error(err);
    return defaultValue;
  }
}

// Register stake
async function registerStake(index, stakeId) {
  try {
    // Example check: must not be registered, must be in valid tier, etc.
    await contract.methods.claimStake(index).send({ from: accounts[0] });
    alert('Stake successfully registered!');
    await getStakeList();
    await displayRemainingSeats();
  } catch (error) {
    console.error('Error registering stake:', error);
    alert('Registration failed. Check console for details.');
  }
}

async function claimReward(stakeIndex) {
  try {
    await contract.methods.claimReward(stakeIndex).send({ from: accounts[0] });
    alert('Reward claimed successfully!');
    await getTokenBalance();
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to claim reward. Check console for more information.');
  }
}

// Return Reward logic
async function returnHXR(stakeIndex, rawEarlyReward) {
  try {
    // For example, parse it from the string you stored in the row
    const earlyRewardWei = web3.utils.toWei(rawEarlyReward, 'ether');
    // Multiply by 1.3 to get final
    const returnAmountWei = (BigInt(earlyRewardWei) * BigInt(130n)) / BigInt(100n);
    const returnAmount = returnAmountWei.toString();

    const currentBalance = await contract.methods.balanceOf(accounts[0]).call();
    if (BigInt(currentBalance) >= BigInt(returnAmount)) {
      await contract.methods.returnReward(stakeIndex, returnAmount).send({ from: accounts[0] });
      alert('Reward returned successfully!');
      await getTokenBalance();
      await getStakeList();
    } else {
      alert('Insufficient balance to return the reward.');
    }
  } catch (error) {
    console.error(error);
    alert('Failed to return reward. Check console for more info.');
  }
}

async function endStake(stakeIndex, stakeId) {
  try {
    const hexAbi = await loadHexABI();
    if (!hexAbi) {
      alert('Failed to load Hex ABI');
      return;
    }
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeEnd(stakeIndex, stakeId).send({ from: accounts[0] });
    alert('Stake ended successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Error ending stake. Check console for details.');
  }
}

async function callGoodAccounting(stakeId, stakeIndex) {
  try {
    const hexContractAddress = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
    const hexAbi = await loadHexABI();
    if (!hexAbi) throw new Error('Failed to load Hex ABI.');
    const hexContract = new web3.eth.Contract(hexAbi, hexContractAddress);

    await hexContract.methods.stakeGoodAccounting(accounts[0], stakeIndex, stakeId).send({
      from: accounts[0],
    });
    alert('Good Accounting called successfully!');
    await getStakeList();
  } catch (error) {
    console.error(error);
    alert('Failed to call Good Accounting. Check console for info.');
  }
}

// Optional utility function for formatting
function formatBigIntWithDecimals(bigInt, divisor, decimalPlaces) {
  const bigIntString = bigInt.toString();
  const length = bigIntString.length;
  // e.g. for hearts: divisor=8 => move decimal 8 places
  const integerPart = bigIntString.slice(0, Math.max(0, length - divisor)) || '0';
  const fractionalPart = bigIntString.slice(Math.max(0, length - divisor));
  const formattedString = `${integerPart}.${fractionalPart.slice(0, decimalPlaces)}`;
  return parseFloat(formattedString).toFixed(decimalPlaces);
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

// Tiers
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

  // Example plain table for tier info
  const tbl = document.createElement('table');
  tbl.classList.add('tier-info');

  const headerRow = document.createElement('tr');
  const headers = ['Tier', 'Hex Stake Size Range', 'Hex Stakes (Seats) Left to Register'];
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  tbl.appendChild(headerRow);

  for (let i = 0; i < 9; i++) {
    const tr = document.createElement('tr');
    const tierTd = document.createElement('td');
    tierTd.textContent = `Tier ${i}`;
    const rangeTd = document.createElement('td');
    rangeTd.textContent = tierRanges[i];
    const seatTd = document.createElement('td');
    seatTd.textContent = remainingSeats[i];

    tr.appendChild(tierTd);
    tr.appendChild(rangeTd);
    tr.appendChild(seatTd);
    tbl.appendChild(tr);
  }
  tierListElement.appendChild(tbl);
}

// Toggle video container logic
const videoContainer = document.getElementById('videoContainer');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');

function toggleVideoVisibility() {
  videoContainer.classList.toggle('hidden');
  if (!videoContainer.classList.contains('hidden')) {
    // Reload Twitter widget if needed
    if (typeof twttr !== 'undefined' && twttr.widgets) {
      twttr.widgets.load();
    }
  }
}

toggleVideoBtn.addEventListener('click', toggleVideoVisibility);

// Add token to MetaMask
async function addTokenToMetaMask() {
  try {
    const tokenSymbol = 'HXR';
    const tokenDecimals = 18;
    const tokenImage = './logo-nobackground-1000.png';    

    const wasAdded = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: contractAddress,
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
    const tokenAddress = hexContractAddress;
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

// Bind click events
document.getElementById('connectButton').addEventListener('click', connectToMetaMask);
document.getElementById('addTokenButton').addEventListener('click', addTokenToMetaMask);
document.getElementById('addHexTokenButton').addEventListener('click', addHexTokenToMetaMask);
