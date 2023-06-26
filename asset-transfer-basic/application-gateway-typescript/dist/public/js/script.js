function viewContract() {
    let view_contract = document.getElementById('view_contract')
    let create_contract = document.getElementById('create_contract')
    view_contract.style.display = 'block';
    create_contract.style.display = 'none';
}

function createContract() {
    let view_contract = document.getElementById('view_contract')
    let create_contract = document.getElementById('create_contract')
    view_contract.style.display = 'none';
    create_contract.style.display = 'flex';
}

function displayLightbox(id, amount, status) {
    let contract_id = document.getElementById('contract_id')
    let contract_amout = document.getElementById('contract_amout')
    let contract_status = document.getElementById('contract_status')
    let lightbox = document.getElementById('lightbox')
    contract_id.textContent = id
    contract_amout.textContent = amount
    contract_status.textContent = status
    lightbox.classList.add('show')
}

function closeLightbox() {
    let lightbox = document.getElementById('lightbox')
    lightbox.classList.remove('show')
}

async function getTransactions() {
	const response = await fetch('http://localhost:3000/transactions')
	const jsonData = await response.json()
	let list_contracts = document.getElementById('list_contracts')
	list_contracts.innerHTML = ''
	jsonData.forEach(item => {
		if (item.docType == 'contract') {
			list_contracts.innerHTML += `<h5 onclick="displayLightbox('${item.ID}', '${item.Amount}', '${item.Status}')">Contract ${item.ID}</h5>`
		}
	})
}

async function sendContract() {
	let signature1 = document.querySelector('input[name="contractor"]').value
	let signature2 = document.querySelector('input[name="hired"]').value
	let amount = document.querySelector('input[name="amount"]').value
	await fetch('http://localhost:3000/create-escrow-contract', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			client: signature1,
			freelancer: signature2,
			value: amount
		})
	})
	await viewContract()
	await getTransactions()
	await document.getElementById('new_contract').reset()
}

async function updateContract() {
	let signature = document.querySelector('input[name="confirmation_signature"]').value
	let operation = document.querySelector('input[name="operation_contract"]:checked').value
	let contract_id = document.getElementById('contract_id').textContent
	let direction = ''
	let json = ''
	if (operation == 'confirm') {
		direction = 'http://localhost:3000/approve-work'
		json = JSON.stringify({
			contractId: contract_id,
			approver: signature
		})
	} else {
		direction = 'http://localhost:3000/cancel-contract'
		json = JSON.stringify({
			contractId: contract_id,
			canceller: signature
		})
	}
	await fetch(direction, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: json
	})
	await closeLightbox()
	window.location.href = '/'
}
