// Contract ABI and Address
let contractABI = [];
let contractAddress = '';
let contract;
let web3;
let accounts = [];
let userRole = 'NONE';

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const disconnectWalletBtn = document.getElementById('disconnectWallet');
const walletStatus = document.getElementById('walletStatus');
const walletAddress = document.getElementById('walletAddress');
const registerLandForm = document.getElementById('registerLandForm');
const viewLandsSection = document.getElementById('viewLandsSection');
const authRequiredModal = new bootstrap.Modal(document.getElementById('authRequiredModal'));
const landsList = document.getElementById('landsList');

// Initialize tables
let landsOnSaleTable;
let allLandsTable;

// Role Management
let roleRequestsTable;

// Add transaction history modal
const transactionHistoryModal = new bootstrap.Modal(document.getElementById('transactionHistoryModal'));

// Load contract info
async function loadContractInfo() {
    try {
        const response = await fetch('contract-info.json');
        if (!response.ok) {
            throw new Error('Failed to load contract info');
        }
        const data = await response.json();
        contractAddress = data.address;
        contractABI = data.abi;
        console.log('Contract info loaded:', contractAddress);
        return true;
    } catch (error) {
        console.error('Error loading contract info:', error);
        return false;
    }
}

// Initialize Web3
async function initWeb3() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            web3 = new Web3(window.ethereum);
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Update UI
            walletStatus.classList.remove('d-none');
            walletAddress.textContent = accounts[0];
            connectWalletBtn.textContent = 'Connected';
            connectWalletBtn.disabled = true;
            
            // Initialize contract
            await initContract();
            
            // Update role
            await updateRole();
            
            return true;
        } catch (error) {
            console.error('Error connecting to MetaMask:', error);
            return false;
        }
    } else {
        console.error('MetaMask not installed');
        return false;
    }
}

// Initialize contract
async function initContract() {
    if (typeof web3 !== 'undefined') {
        try {
            // Get contract ABI and address
            const response = await fetch('contract-info.json');
            const contractInfo = await response.json();
            
            // Initialize contract
            contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);
            console.log('Contract initialized at:', contractInfo.address);
            
            // Get total lands count
            const landCounter = await contract.methods.landCounter().call();
            console.log('Total lands:', landCounter);
            
            // Load initial data
            await loadAllLands();
            await loadLandsOnSale();
            
            // Update UI
            updateUI();
            
            return true;
        } catch (error) {
            console.error('Error initializing contract:', error);
            showError('Failed to initialize contract. Please check console for details.');
            return false;
        }
    } else {
        console.error('Web3 is not initialized');
        return false;
    }
}

// Update user role
async function updateRole() {
    if (!contract || !accounts.length) return;
    
    try {
        userRole = await contract.methods.getUserRole(accounts[0]).call();
        console.log('User role:', userRole);
        
        // Update UI based on role
        await updateUI();
    } catch (error) {
        console.error('Error getting user role:', error);
    }
}

// Update UI based on role
async function updateUI() {
    const isConnected = accounts.length > 0;
    
    // Update button visibility
    connectWalletBtn.style.display = isConnected ? 'none' : 'block';
    disconnectWalletBtn.style.display = isConnected ? 'block' : 'none';
    
    // Show role management section when connected
    const roleManagement = document.getElementById('roleManagement');
    if (roleManagement) {
        roleManagement.style.display = isConnected ? 'block' : 'none';
    }
    
    // Show register land form when connected
    const registerLandForm = document.getElementById('registerLandForm');
    if (registerLandForm) {
        registerLandForm.style.display = isConnected ? 'block' : 'none';
    }
    
    if (isConnected) {
        try {
            // Get user's role
            const role = await contract.methods.getUserRole(accounts[0]).call();
            console.log('Current role:', role);
            
            // Show/hide role request form based on current role
            const roleRequestForm = document.getElementById('roleRequestForm');
            if (roleRequestForm) {
                roleRequestForm.style.display = role === '0' ? 'block' : 'none';
            }
            
            // Show/hide government panel
            const governmentPanel = document.getElementById('governmentPanel');
            if (governmentPanel) {
                governmentPanel.style.display = role === '3' ? 'block' : 'none';
                if (role === '3') {
                    await loadRoleRequests();
                }
            }
            
            // Update role display
            const roleDisplay = document.getElementById('userRole');
            if (roleDisplay) {
                roleDisplay.textContent = `Connected as: ${getRoleName(role)}`;
            }
            
            // Update other UI elements based on role
            updateRoleSpecificUI();
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }
}

// Update role-specific UI elements
async function updateRoleSpecificUI() {
    if (!contract || !accounts.length) return;

    try {
        const role = await contract.methods.getUserRole(accounts[0]).call();
        const verifyButtons = document.querySelectorAll('.verify-land-btn');
        const listButtons = document.querySelectorAll('.list-land-btn');
        const purchaseButtons = document.querySelectorAll('.purchase-land-btn');

        // Show/hide verify buttons based on GOVERNMENT role
        verifyButtons.forEach(btn => {
            btn.style.display = role === '3' ? 'inline-block' : 'none';
        });

        // Show/hide list and purchase buttons based on USER role
        const showUserActions = role === '1';
        listButtons.forEach(btn => {
            btn.style.display = showUserActions ? 'inline-block' : 'none';
        });
        purchaseButtons.forEach(btn => {
            btn.style.display = showUserActions ? 'inline-block' : 'none';
        });
    } catch (error) {
        console.error('Error updating role UI:', error);
    }
}

// Load initial data
async function loadInitialData() {
    try {
        // Initialize Web3 with a provider that can read from the blockchain
        if (typeof window.ethereum !== 'undefined') {
            web3 = new Web3(window.ethereum);
        } else {
            // Fallback to a public RPC if MetaMask is not available
            web3 = new Web3(new Web3.providers.HttpProvider('https://rpc-amoy.polygon.technology'));
        }

        // Load contract info
        const response = await fetch('contract-info.json');
        const contractInfo = await response.json();
        contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);

        // Load both tables
        await loadAllLands();
        await loadLandsOnSale();
    } catch (error) {
        console.error('Error loading initial data:', error);
        // Still show empty tables even if there's an error
        loadAllLands();
        loadLandsOnSale();
    }
}

// Initialize tables
function initTables() {
    // Initialize lands on sale table
    landsOnSaleTable = $('#landsOnSaleTable').DataTable({
        columns: [
            { data: 'plotNumber' },
            { data: 'name' },
            { data: 'location' },
            { data: 'size' },
            { data: 'price' },
            { data: 'owner' },
            { 
                data: null,
                render: function(data, type, row) {
                    if (!row || row.plotNumber === 'No lands on sale') {
                        return '';
                    }
                    let buttons = '';
                    // Show buy button for all users including government
                    buttons += `<button class="btn btn-sm btn-primary purchase-land-btn" data-land-id="${row.id}">Buy</button>`;
                    return buttons;
                }
            }
        ],
        searching: false,
        paging: true,
        pageLength: 5,
        info: true,
        data: []
    });

    // Initialize all lands table
    allLandsTable = $('#allLandsTable').DataTable({
        columns: [
            { data: 'plotNumber' },
            { data: 'name' },
            { data: 'location' },
            { data: 'size' },
            { data: 'status' },
            { data: 'owner' },
            { data: 'verifiedBy' },
            { 
                data: null,
                render: function(data, type, row) {
                    if (!row || row.plotNumber === 'No lands registered') {
                        return '';
                    }
                    let buttons = '';
                    // Show verify button for government/verifier
                    if (row.status === 'PENDING' && (userRole === '3' || userRole === '2')) {
                        buttons += `<button class="btn btn-sm btn-success verify-land-btn" data-land-id="${row.id}">Verify</button> `;
                    }
                    // Show list for sale button for owner or government
                    if ((row.owner === accounts[0] || userRole === '3') && !row.isOnSale) {
                        buttons += `<button class="btn btn-sm btn-warning list-land-btn" data-land-id="${row.id}">List for Sale</button> `;
                    }
                    // Show transaction history button for all users
                    buttons += `<button class="btn btn-sm btn-info transaction-history-btn" data-land-id="${row.id}">History</button>`;
                    return buttons || '-';
                }
            }
        ],
        searching: true,
        paging: true,
        pageLength: 5,
        info: true,
        data: []
    });

    // Initialize role requests table
    roleRequestsTable = $('#roleRequestsTable').DataTable({
        columns: [
            { data: 'address' },
            { data: 'role' },
            { 
                data: null,
                render: function(data, type, row) {
                    if (!row || row.address === 'No pending requests') {
                        return '';
                    }
                    return `
                        <button class="btn btn-sm btn-success approve-role" data-address="${row.address}">Approve</button>
                        <button class="btn btn-sm btn-danger reject-role" data-address="${row.address}">Reject</button>
                    `;
                }
            }
        ],
        searching: false,
        paging: false,
        info: false,
        data: []
    });

    // Add event listener for transaction history buttons
    document.getElementById('allLandsTable').addEventListener('click', function(event) {
        if (event.target.matches('.transaction-history-btn')) {
            const landId = event.target.dataset.landId;
            showLandTransactionHistory(landId);
        }
    });
}

// Load all lands
async function loadAllLands() {
    if (!contract) {
        console.error('Contract not initialized');
        return;
    }

    try {
        const landCounter = await contract.methods.landCounter().call();
        console.log('Total lands:', landCounter);
        
        // Clear existing data
        allLandsTable.clear();
        
        if (landCounter > 0) {
            // Load each land
            for (let i = 1; i <= landCounter; i++) {
                try {
                    const land = await contract.methods.getLandDetails(i).call();
                    allLandsTable.row.add({
                        id: i,
                        plotNumber: land.plotNumber,
                        name: land.name,
                        location: land.location,
                        size: land.size,
                        status: land.verificationStatus,
                        owner: land.currentOwner,
                        verifiedBy: land.verifiedBy || 'Not verified',
                        isOnSale: land.isOnSale
                    });
                } catch (error) {
                    console.error(`Error loading land ${i}:`, error);
                }
            }
        } else {
            // Add empty state message
            allLandsTable.row.add({
                plotNumber: 'No lands registered',
                name: '-',
                location: '-',
                size: '-',
                status: '-',
                owner: '-',
                verifiedBy: '-',
                isOnSale: false
            });
        }
        
        // Draw the table
        allLandsTable.draw();
    } catch (error) {
        console.error('Error loading all lands:', error);
        // Add empty state message on error
        allLandsTable.clear();
        allLandsTable.row.add({
            plotNumber: 'No lands registered',
            name: '-',
            location: '-',
            size: '-',
            status: '-',
            owner: '-',
            verifiedBy: '-',
            isOnSale: false
        });
        allLandsTable.draw();
    }
}

// Load lands on sale
async function loadLandsOnSale() {
    if (!contract) {
        console.error('Contract not initialized');
        return;
    }

    try {
        const landCounter = await contract.methods.landCounter().call();
        console.log('Total lands:', landCounter);
        
        // Clear existing data
        landsOnSaleTable.clear();
        
        if (landCounter > 0) {
            // Load each land
            for (let i = 1; i <= landCounter; i++) {
                try {
                    const land = await contract.methods.getLandDetails(i).call();
                    if (land.isOnSale) {
                        landsOnSaleTable.row.add({
                            id: i,
                            plotNumber: land.plotNumber,
                            name: land.name,
                            location: land.location,
                            size: land.size,
                            price: web3.utils.fromWei(land.price, 'ether') + ' MATIC',
                            owner: land.currentOwner
                        });
                    }
                } catch (error) {
                    console.error(`Error loading land ${i}:`, error);
                }
            }
        }
        
        if (landsOnSaleTable.data().length === 0) {
            // Add empty state message
            landsOnSaleTable.row.add({
                plotNumber: 'No lands on sale',
                name: '-',
                location: '-',
                size: '-',
                price: '-',
                owner: '-'
            });
        }
        
        // Draw the table
        landsOnSaleTable.draw();
    } catch (error) {
        console.error('Error loading lands on sale:', error);
        // Add empty state message on error
        landsOnSaleTable.clear();
        landsOnSaleTable.row.add({
            plotNumber: 'No lands on sale',
            name: '-',
            location: '-',
            size: '-',
            price: '-',
            owner: '-'
        });
        showError('Failed to load lands on sale. Please check console for details.');
    }
}

// Handle table actions
async function handleTableAction(event) {
    const target = event.target;
    if (!target.matches('.purchase-land-btn, .verify-land-btn, .list-land-btn')) return;

    const landId = target.dataset.landId;
    if (target.matches('.purchase-land-btn')) {
        await handlePurchase(landId);
    } else if (target.matches('.verify-land-btn')) {
        await handleVerifyLand(landId);
    } else if (target.matches('.list-land-btn')) {
        await handleListForSale(landId);
    }
}

// Handle land verification
async function handleVerifyLand(landId) {
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    try {
        // Check if user has GOVERNMENT role
        const role = await contract.methods.getUserRole(accounts[0]).call();
        if (role !== '3' && role !== '2') {
            showError('Only government officials or verifiers can verify land');
            return;
        }

        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.verifyLand(landId).estimateGas({ 
            from: accounts[0],
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.verifyLand(landId).send({ 
            from: accounts[0],
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Land verified successfully!');
        
        // Update tables
        await loadAllLands();
        await loadLandsOnSale();
    } catch (error) {
        console.error('Error verifying land:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else if (error.message.includes('insufficient funds')) {
                showError('Insufficient funds for gas');
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else {
            showError('Error verifying land: ' + error.message);
        }
    }
}

// Handle listing land for sale
async function handleListForSale(landId) {
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    try {
        // Get user's role
        const role = await contract.methods.getUserRole(accounts[0]).call();
        
        // Get land details
        const landDetails = await contract.methods.getLandDetails(landId).call();
        
        // Check if user can list the land
        if (landDetails.currentOwner !== accounts[0] && role !== '3') {
            showError('Only the owner or government can list land for sale');
            return;
        }

        // Check if land is verified
        if (landDetails.verificationStatus !== 'VERIFIED') {
            showError('Land must be verified before listing for sale');
            return;
        }

        // Check if land is already on sale
        if (landDetails.isOnSale) {
            showError('Land is already listed for sale');
            return;
        }

        const price = prompt('Enter price in MATIC:');
        if (!price) return;

        const priceInWei = web3.utils.toWei(price, 'ether');
        
        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.listLandForSale(landId, priceInWei).estimateGas({ 
            from: accounts[0],
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.listLandForSale(landId, priceInWei).send({ 
            from: accounts[0],
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Land listed for sale successfully!');
        
        // Update tables
        await loadAllLands();
        await loadLandsOnSale();
    } catch (error) {
        console.error('Error listing land for sale:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else if (error.message.includes('insufficient funds')) {
                showError('Insufficient funds for gas');
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else {
            showError('Error listing land for sale: ' + error.message);
        }
    }
}

// Handle land purchase
async function handlePurchase(landId) {
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    try {
        const land = await contract.methods.getLandDetails(landId).call();
        const price = land.price;
        
        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.purchaseLand(landId).estimateGas({ 
            from: accounts[0],
            value: price,
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.purchaseLand(landId).send({ 
            from: accounts[0],
            value: price,
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Land purchased successfully!');
        
        // Update tables
        await loadLandsOnSale();
        await loadAllLands();
    } catch (error) {
        console.error('Error purchasing land:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else if (error.message.includes('insufficient funds')) {
                showError('Insufficient funds for purchase');
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else {
            showError('Error purchasing land: ' + error.message);
        }
    }
}

// Handle land registration
async function handleLandRegistration(e) {
    e.preventDefault();
    
    if (!contract) {
        showError('Contract not initialized. Please try again later.');
        return;
    }

    if (accounts.length === 0) {
        authRequiredModal.show();
        return;
    }

    const name = document.getElementById('landName').value;
    const plotNumber = document.getElementById('plotNumber').value;
    const size = document.getElementById('landSize').value;
    const location = document.getElementById('location').value;
    const coordinates = document.getElementById('coordinates').value;
    const ipfsHash = document.getElementById('ipfsHash').value;

    // Validate inputs
    if (!name || !plotNumber || !size || !location || !coordinates || !ipfsHash) {
        showError('Please fill in all fields');
        return;
    }

    try {
        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.registerLand(
            name,
            size,
            coordinates,
            ipfsHash,
            location,
            plotNumber
        ).estimateGas({ 
            from: accounts[0],
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.registerLand(
            name,
            size,
            coordinates,
            ipfsHash,
            location,
            plotNumber
        ).send({ 
            from: accounts[0],
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Land registered successfully!');
        document.getElementById('landRegistrationForm').reset();
        await loadAllLands();
    } catch (error) {
        console.error('Error registering land:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else if (error.message.includes('insufficient funds')) {
            showError('Insufficient funds for gas');
        } else {
            showError('Error registering land: ' + error.message);
        }
    }
}

// Show success message
function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.container').firstChild);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Show error message
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger alert-dismissible fade show';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.container').firstChild);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tables
    initTables();
    
    // Initialize Web3 and contract
    initWeb3().then(() => {
        if (web3) {
            initContract();
        }
    });

    // Add event listeners
    document.getElementById('governmentTransferForm').addEventListener('submit', handleGovernmentTransfer);
    
    // Add event listeners for table actions
    document.getElementById('allLandsTable').addEventListener('click', handleTableAction);
    document.getElementById('landsOnSaleTable').addEventListener('click', handleTableAction);

    // Load initial data immediately
    loadInitialData();
});

// Search by plot number
async function searchByPlotNumber(plotNumber) {
    if (!contract) return;

    try {
        const landId = await contract.methods.getLandByPlotNumber(plotNumber).call();
        if (landId > 0) {
            const land = await contract.methods.getLandDetails(landId).call();
            
            // Clear and add the found land to the table
            allLandsTable.clear();
            allLandsTable.row.add([
                land.plotNumber,
                land.name,
                land.location,
                land.size,
                land.verificationStatus,
                land.currentOwner,
                land.verifiedBy || 'Not verified',
                getActionButtons(landId, land)
            ]);
            allLandsTable.draw();
        } else {
            showError('No land found with this plot number');
        }
    } catch (error) {
        console.error('Error searching by plot number:', error);
        showError('Error searching for land. Please check console for details.');
    }
}

// Connect to MetaMask
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showError('Please install MetaMask to use this application');
            return;
        }

        // Request account access
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Connected account:', accounts[0]);

        // Initialize Web3
        web3 = new Web3(window.ethereum);
        
        // Load contract info and initialize
        await loadContractInfo();
        await initContract();
        
        // Update UI
        updateUI();
        
        // Load initial data
        await loadInitialData();
        
        showSuccess('Wallet connected successfully!');
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

// Disconnect wallet
async function disconnectWallet() {
    try {
        // Request MetaMask to disconnect
        if (window.ethereum && window.ethereum.removeAllListeners) {
            window.ethereum.removeAllListeners();
        }

        // Clear local state
        accounts = [];
        contract = null;
        web3 = null;
        
        // Reset UI elements
        const walletStatus = document.getElementById('walletStatus');
        if (walletStatus) {
            walletStatus.classList.add('d-none');
        }
        
        // Reset DataTables
        if (landsOnSaleTable) {
            landsOnSaleTable.clear().draw();
        }
        if (allLandsTable) {
            allLandsTable.clear().draw();
        }
        
        // Hide all role-specific sections
        const adminPanel = document.getElementById('adminPanel');
        const verifierPanel = document.getElementById('verifierPanel');
        const registrarPanel = document.getElementById('registrarPanel');
        
        if (adminPanel) adminPanel.classList.add('d-none');
        if (verifierPanel) verifierPanel.classList.add('d-none');
        if (registrarPanel) registrarPanel.classList.add('d-none');
        
        // Reset forms
        const registerLandForm = document.getElementById('registerLandForm');
        if (registerLandForm) {
            // Clear form inputs
            const inputs = registerLandForm.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.value = '';
            });
            registerLandForm.style.display = 'none';
        }
        
        // Update button states
        connectWalletBtn.style.display = 'block';
        disconnectWalletBtn.style.display = 'none';
        
        // Clear any existing alerts
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => alert.remove());
        
        showSuccess('Wallet disconnected successfully!');
        
        // Force a page reload to ensure clean state
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        showError('Failed to disconnect wallet: ' + error.message);
    }
}

// Event Listeners
connectWalletBtn.addEventListener('click', connectWallet);
disconnectWalletBtn.addEventListener('click', disconnectWallet);

// Handle account changes
window.ethereum.on('accountsChanged', async (newAccounts) => {
    accounts = newAccounts;
    if (accounts.length > 0) {
        await initContract();
        updateUI();
        await loadInitialData();
    } else {
        updateUI();
    }
});

// Handle chain changes
window.ethereum.on('chainChanged', () => {
    window.location.reload();
});

// Role Management
async function initRoleManagement() {
    // Initialize role requests table
    roleRequestsTable = $('#roleRequestsTable').DataTable({
        columns: [
            { data: 'address' },
            { data: 'role' },
            { 
                data: null,
                render: function(data, type, row) {
                    if (row.address === 'No pending requests') {
                        return '';
                    }
                    return `
                        <button class="btn btn-sm btn-success approve-role" data-address="${row.address}">Approve</button>
                        <button class="btn btn-sm btn-danger reject-role" data-address="${row.address}">Reject</button>
                    `;
                }
            }
        ],
        searching: false,
        paging: false,
        info: false
    });

    // Add event listeners
    document.getElementById('requestRoleBtn').addEventListener('click', handleRoleRequest);
    document.getElementById('roleRequestsTable').addEventListener('click', handleRoleAction);
    document.getElementById('directRoleAssignmentForm').addEventListener('submit', handleDirectRoleAssignment);
}

// Load role requests
async function loadRoleRequests() {
    if (!contract || !accounts.length) return;

    try {
        // Get all role requests
        const requests = await contract.methods.getRoleRequests().call();
        console.log('Role requests:', requests);
        
        // Clear existing data
        roleRequestsTable.clear();
        
        if (requests && requests.length > 0) {
            // Add each request to the table
            for (let i = 0; i < requests.length; i++) {
                const request = requests[i];
                if (request && request.user && request.role) {
                    roleRequestsTable.row.add({
                        address: request.user,
                        role: getRoleName(request.role)
                    });
                }
            }
        }
        
        // If no requests or all requests were invalid, add empty state message
        if (roleRequestsTable.data().length === 0) {
            roleRequestsTable.row.add({
                address: 'No pending requests',
                role: '-'
            });
        }
        
        // Draw the table
        roleRequestsTable.draw();
    } catch (error) {
        console.error('Error loading role requests:', error);
        // Add empty state message on error
        roleRequestsTable.clear();
        roleRequestsTable.row.add({
            address: 'No pending requests',
            role: '-'
        });
        roleRequestsTable.draw();
    }
}

// Get role name from role value
function getRoleName(roleValue) {
    const roles = {
        '0': 'None',
        '1': 'User',
        '2': 'Verifier',
        '3': 'Government'
    };
    return roles[roleValue] || 'Unknown';
}

// Function to handle role request
async function handleRoleRequest() {
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    try {
        const roleSelect = document.getElementById('roleSelect');
        const roleValue = parseInt(roleSelect.value);
        
        // Request role
        await contract.methods.requestRole(roleValue).send({ from: accounts[0] });
        showSuccess('Role request submitted successfully!');
    } catch (error) {
        console.error('Error requesting role:', error);
        showError('Failed to request role: ' + error.message);
    }
}

// Function to handle role approval/rejection
async function handleRoleAction(event) {
    if (!contract || !accounts.length) return;

    const target = event.target;
    if (!target.matches('.approve-role, .reject-role')) return;

    const address = target.dataset.address;
    try {
        if (target.matches('.approve-role')) {
            await contract.methods.approveRole(address).send({ from: accounts[0] });
            showSuccess('Role approved successfully!');
        } else {
            await contract.methods.rejectRole(address).send({ from: accounts[0] });
            showSuccess('Role rejected successfully!');
        }
        await loadRoleRequests();
    } catch (error) {
        console.error('Error processing role action:', error);
        showError('Failed to process role action: ' + error.message);
    }
}

// Function to handle direct role assignment
async function handleDirectRoleAssignment(e) {
    e.preventDefault();
    
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    const userAddress = document.getElementById('userAddress').value;
    const roleValue = parseInt(document.getElementById('directRoleSelect').value);

    try {
        // Validate address
        if (!web3.utils.isAddress(userAddress)) {
            showError('Invalid Ethereum address');
            return;
        }

        // Check if user already has a role
        const currentRole = await contract.methods.getUserRole(userAddress).call();
        if (currentRole !== '0') {
            showError('User already has a role');
            return;
        }

        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.assignRole(userAddress, roleValue).estimateGas({ 
            from: accounts[0],
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.assignRole(userAddress, roleValue).send({ 
            from: accounts[0],
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Role assigned successfully!');
        
        // Reset form
        document.getElementById('directRoleAssignmentForm').reset();
        
        // Reload role requests
        await loadRoleRequests();
    } catch (error) {
        console.error('Error assigning role:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else if (error.message.includes('insufficient funds')) {
                showError('Insufficient funds for gas');
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else {
            showError('Error assigning role: ' + error.message);
        }
    }
}

// Initialize role management when the page loads
document.addEventListener('DOMContentLoaded', initRoleManagement);

// Function to handle land transfer request
async function handleTransferRequest(e) {
    e.preventDefault();
    
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    const landId = document.getElementById('transferLandId').value;
    const toAddress = document.getElementById('transferToAddress').value;

    try {
        // Validate address
        if (!web3.utils.isAddress(toAddress)) {
            showError('Invalid Ethereum address');
            return;
        }

        // Request transfer
        await contract.methods.requestTransfer(landId, toAddress).send({ from: accounts[0] });
        showSuccess('Transfer request submitted successfully!');
        
        // Reset form
        document.getElementById('transferRequestForm').reset();
        
        // Update pending transfers table
        await loadPendingTransfers();
    } catch (error) {
        console.error('Error requesting transfer:', error);
        showError('Failed to request transfer: ' + error.message);
    }
}

// Function to load pending transfers
async function loadPendingTransfers() {
    if (!contract || !accounts.length) return;

    try {
        // Get all pending transfers
        const [requestIds, fromAddresses, toAddresses, landIds] = await contract.methods.getPendingTransfers().call();
        
        // Clear and update table
        pendingTransfersTable.clear();
        for (let i = 0; i < requestIds.length; i++) {
            pendingTransfersTable.row.add({
                requestId: requestIds[i],
                from: fromAddresses[i],
                to: toAddresses[i],
                landId: landIds[i]
            });
        }
        pendingTransfersTable.draw();
    } catch (error) {
        console.error('Error loading pending transfers:', error);
    }
}

// Function to handle transfer approval/rejection
async function handleTransferAction(event) {
    if (!contract || !accounts.length) return;

    const target = event.target;
    if (!target.matches('.approve-transfer, .reject-transfer')) return;

    const requestId = target.dataset.requestId;
    try {
        if (target.matches('.approve-transfer')) {
            await contract.methods.approveTransfer(requestId).send({ from: accounts[0] });
            showSuccess('Transfer approved successfully!');
        } else {
            await contract.methods.rejectTransfer(requestId).send({ from: accounts[0] });
            showSuccess('Transfer rejected successfully!');
        }
        await loadPendingTransfers();
    } catch (error) {
        console.error('Error processing transfer action:', error);
        showError('Failed to process transfer action: ' + error.message);
    }
}

// Initialize transfer management
function initTransferManagement() {
    // Add event listeners for transfer forms
    document.getElementById('transferRequestForm').addEventListener('submit', handleTransferRequest);
    
    // Add event listener for transfer actions
    document.getElementById('pendingTransfersTable').addEventListener('click', handleTransferAction);
    
    // Load pending transfers
    loadPendingTransfers();
}

// Update UI based on user role
async function updateRoleSpecificUI(role) {
    // Show/hide transfer request form based on role
    const transferRequestForm = document.getElementById('transferRequestForm');
    if (transferRequestForm) {
        transferRequestForm.style.display = role === '1' ? 'block' : 'none';
    }
    
    // Show/hide pending transfers table based on role
    const pendingTransfersTable = document.getElementById('pendingTransfersTable');
    if (pendingTransfersTable) {
        pendingTransfersTable.style.display = role === '3' ? 'block' : 'none';
    }
}

// Handle government transfer
async function handleGovernmentTransfer(e) {
    e.preventDefault();
    
    if (!contract || !accounts.length) {
        authRequiredModal.show();
        return;
    }

    const plotNumber = document.getElementById('govLandId').value;
    const toAddress = document.getElementById('govToAddress').value;

    try {
        // Validate address
        if (!web3.utils.isAddress(toAddress)) {
            showError('Invalid Ethereum address');
            return;
        }

        // Get land ID from plot number
        const landId = await contract.methods.getLandByPlotNumber(plotNumber).call();
        console.log('Land ID:', landId);
        
        if (landId === '0') {
            showError('Land not found with this plot number');
            return;
        }

        // Get land details to verify ownership
        const landDetails = await contract.methods.getLandDetails(landId).call();
        console.log('Land details:', landDetails);

        // Check if the land is owned by the zero address (available for government transfer)
        if (landDetails.currentOwner !== '0x0000000000000000000000000000000000000000') {
            showError('This land is already owned by someone else');
            return;
        }

        // Get current gas price
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        // Estimate gas with a higher multiplier for safety
        const gasEstimate = await contract.methods.transferFromGovernment(toAddress, landId).estimateGas({ 
            from: accounts[0],
            gasPrice: gasPrice
        });

        console.log('Estimated gas:', gasEstimate);

        // Add 20% buffer to gas estimate
        const gasWithBuffer = Math.floor(gasEstimate * 1.2);

        // Send transaction with proper gas settings
        const result = await contract.methods.transferFromGovernment(toAddress, landId).send({ 
            from: accounts[0],
            gas: gasWithBuffer,
            gasPrice: gasPrice
        });

        console.log('Transaction receipt:', result);

        showSuccess('Land transferred successfully!');
        
        // Reset form
        document.getElementById('governmentTransferForm').reset();
        
        // Update tables
        await loadAllLands();
        await loadPendingTransfers();
    } catch (error) {
        console.error('Error transferring land:', error);
        
        // More detailed error handling
        if (error.code === -32603) {
            if (error.message.includes('execution reverted')) {
                const revertReason = error.message.split('execution reverted:')[1];
                showError(`Transaction failed: ${revertReason}`);
            } else if (error.message.includes('insufficient funds')) {
                showError('Insufficient funds for gas');
            } else {
                showError('Transaction failed. Please check your gas settings and try again.');
            }
        } else if (error.message.includes('User denied')) {
            showError('Transaction was rejected by user');
        } else {
            showError('Error transferring land: ' + error.message);
        }
    }
}

// Function to show land transaction history
async function showLandTransactionHistory(landId) {
    try {
        const [timestamps, froms, tos, types, prices] = await contract.methods.getLandTransactionHistory(landId).call();
        
        const tbody = document.querySelector('#transactionHistoryTable tbody');
        tbody.innerHTML = '';
        
        for (let i = 0; i < timestamps.length; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(timestamps[i] * 1000).toLocaleString()}</td>
                <td>${froms[i]}</td>
                <td>${tos[i]}</td>
                <td>${types[i]}</td>
                <td>${web3.utils.fromWei(prices[i], 'ether')}</td>
            `;
            tbody.appendChild(row);
        }
        
        transactionHistoryModal.show();
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        showError('Error fetching transaction history');
    }
}

// Function to search wallet transactions
async function searchWalletTransactions() {
    const address = document.getElementById('searchAddress').value;
    
    if (!web3.utils.isAddress(address)) {
        showError('Invalid Ethereum address');
        return;
    }
    
    try {
        const [timestamps, froms, tos, types, prices] = await contract.methods.getWalletTransactionHistory(address).call();
        
        const tbody = document.querySelector('#transactionHistoryTable tbody');
        tbody.innerHTML = '';
        
        for (let i = 0; i < timestamps.length; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(timestamps[i] * 1000).toLocaleString()}</td>
                <td>${froms[i]}</td>
                <td>${tos[i]}</td>
                <td>${types[i]}</td>
                <td>${web3.utils.fromWei(prices[i], 'ether')}</td>
            `;
            tbody.appendChild(row);
        }
    } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        showError('Error fetching wallet transactions');
    }
}

