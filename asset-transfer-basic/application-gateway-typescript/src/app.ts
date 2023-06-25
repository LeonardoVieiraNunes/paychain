/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, EndorseError, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import express from 'express';
import { TextDecoder } from 'util';

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore'));

// Path to user certificate.
const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
let contract: Contract;

async function newGrpcConnection(): Promise<grpc.Client> {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity(): Promise<Identity> {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract: Contract): Promise<void> {
    console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');

    await contract.submitTransaction('InitLedger');
    
    console.log('*** Transaction committed successfully');
}

async function createEscrowContract(req: express.Request, res: express.Response): Promise<void> {
    const { client, freelancer, value } = req.body;
    
    if (!client || !freelancer || !value) {
        res.status(400).json({ error: 'Missing required field(s)' });
    }

    const contractId = 'banana'

    try {
        await contract.submitTransaction('CreateEscrowContract', contractId, client, freelancer, value);
        res.json({ message: 'Transaction committed successfully' });
    } catch (error) {
        const message = (error as EndorseError).details[0].message;
        res.status(500).json({ error: 'Failed to submit transaction', cause: message });
    }
}

async function approveWork(req: express.Request, res: express.Response): Promise<void> {
    const { contractId, approver } = req.body;
    
    if (!contractId || !approver) {
        res.status(400).json({ error: 'Missing required field(s)' });
    }

    try {
        await contract.submitTransaction('ApproveWork', contractId, approver);
        res.json({ message: 'Transaction committed successfully' });
    } catch (error) {
        const message = (error as EndorseError).details[0].message;
        res.status(500).json({ error: 'Failed to submit transaction', cause: message });
    }
}


async function cancelContract(req: express.Request, res: express.Response): Promise<void> {
    const { contractId, canceller } = req.body;

    if (!contractId || !canceller) {
        res.status(400).json({ error: 'Missing required field(s)' });
        return;
    }

    try {
        await contract.submitTransaction('CancelContract', contractId, canceller);
        res.json({ message: 'Transaction committed successfully' });
    } catch (error) {
        const message = (error as EndorseError).details[0].message;
        res.status(500).json({ error: 'Failed to submit transaction', cause: message });
    }
}

async function getAccountBalance(req: express.Request, res: express.Response): Promise<void> {
    const { id } = req.params;
    
    if (!id) {
        res.status(400).json({ error: 'Missing required field(s)' });
    }

    try {
        const balanceBytes = await contract.evaluateTransaction('GetAccountBalance', id);
        const resultJson = utf8Decoder.decode(balanceBytes);
        const balance = JSON.parse(resultJson);
        res.json({ balance });
    } catch (error) {
        console.log(error)
        const message = (error as EndorseError).details[0].message;
        res.status(500).json({ error: 'Failed to submit transaction', cause: message });
    }
}


/**
 * Evaluate a transaction to query ledger state.
 */
async function getAllTransactions(req: express.Request, res: express.Response): Promise<void> {
    const resultBytes = await contract.evaluateTransaction('GetAllTransactions');
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    res.json(result);
}

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
async function displayInputParameters(): Promise<void> {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certPath:          ${certPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}

// Função init
async function init() {
    await displayInputParameters()
    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    // Get a network instance representing the channel where the smart contract is deployed.
    const network = gateway.getNetwork(channelName);

    // Get the smart contract from the network.
    contract = network.getContract(chaincodeName);

    // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
    await initLedger(contract);
}

init()
    .then(() => {
        const app = express();
        app.use(express.json());
        app.get('/transactions', getAllTransactions);
        app.post('/create-escrow-contract', createEscrowContract);
        app.post('/approve-work', approveWork);
        app.post('/cancel-contract', cancelContract);
        app.get('/account/:id/balance', getAccountBalance);
        app.listen(3000, () => console.log('Server started on port 3000'));
    })
    .catch((error) => {
        console.error('Failed to initialize the server:', error);
        process.exit(1);
    });