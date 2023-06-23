import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import { Account } from './account';
import { Transaction as Trans } from './transaction';
import { EscrowContract } from './escrowContract';

@Info({ title: 'PaymentSystem', description: 'Smart contract for managing payments between accounts' })
export class PaymentSystemContract extends Contract {

    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const accounts: Account[] = [
            {
                docType: 'account',
                ID: 'client1',
                Balance: 5000,
            },
            {
                docType: 'account',
                ID: 'freelancer1',
                Balance: 0,
            }
        ];

        for (const account of accounts) {
            await ctx.stub.putState(account.ID, Buffer.from(JSON.stringify(account)));
            console.info(`Account ${account.ID} initialized`);
        }
    }

    // TransferFunds moves the specified amount of funds from the source account to the target account, and records the transaction.
    @Transaction()
    public async TransferFunds(ctx: Context, sourceID: string, targetID: string, amount: number): Promise<void> {
        const sourceAccountJSON = await ctx.stub.getState(sourceID);
        const targetAccountJSON = await ctx.stub.getState(targetID);
        if (!sourceAccountJSON || sourceAccountJSON.length === 0) {
            throw new Error(`The account ${sourceID} does not exist`);
        }
        if (!targetAccountJSON || targetAccountJSON.length === 0) {
            throw new Error(`The account ${targetID} does not exist`);
        }
        const sourceAccount = JSON.parse(sourceAccountJSON.toString()) as Account;
        const targetAccount = JSON.parse(targetAccountJSON.toString()) as Account;
        if (sourceAccount.Balance < amount) {
            throw new Error('Insufficient funds');
        }
        sourceAccount.Balance -= amount;
        targetAccount.Balance += amount;
        await ctx.stub.putState(sourceID, Buffer.from(JSON.stringify(sourceAccount)));
        await ctx.stub.putState(targetID, Buffer.from(JSON.stringify(targetAccount)));

        const transaction: Trans = {
            ID: `${sourceID}-${targetID}-${Date.now()}`,
            docType: 'transaction',
            Source: sourceID,
            Target: targetID,
            Amount: amount,
            DateTime: new Date().toISOString(),
        };
        await ctx.stub.putState(transaction.ID, Buffer.from(JSON.stringify(transaction)));
    }

    // GetAccountBalance returns the balance of the account with the given id.
    @Transaction(false)
    public async GetAccountBalance(ctx: Context, id: string): Promise<string> {
        const accountJSON = await ctx.stub.getState(id);
        if (!accountJSON || accountJSON.length === 0) {
            throw new Error(`The account ${id} does not exist`);
        }
        const account = JSON.parse(accountJSON.toString()) as Account;
        return account.Balance.toString();
    }

    // GetAllTransactions returns all transactions stored in the world state.
    @Transaction(false)
    public async GetAllTransactions(ctx: Context): Promise<string> {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    // Create a new escrow contract.
    @Transaction()
    public async CreateEscrowContract(ctx: Context, id: string, client: string, freelancer: string, amount: number): Promise<void> {
        const clientAccountJSON = await ctx.stub.getState(client);
        const clientAccount = JSON.parse(clientAccountJSON.toString()) as Account;
        if (clientAccount.Balance < amount) {
            throw new Error('Insufficient funds');
        }
        clientAccount.Balance -= amount;
        await ctx.stub.putState(client, Buffer.from(JSON.stringify(clientAccount)));

        const contract: EscrowContract = {
            ID: id,
            docType: 'contract',
            Client: client,
            Freelancer: freelancer,
            Amount: amount,
            Status: 'OPEN',
            ClientApproval: false,
            FreelancerApproval: false,
        };
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(contract)));
    }

    // Approve the work for an escrow contract.
    @Transaction()
    public async ApproveWork(ctx: Context, contractID: string, approver: string): Promise<void> {
        const contractJSON = await ctx.stub.getState(contractID);
        const contract = JSON.parse(contractJSON.toString()) as EscrowContract;
        if (approver === contract.Client) {
            contract.ClientApproval = true;
        } else if (approver === contract.Freelancer) {
            contract.FreelancerApproval = true;
        } else {
            throw new Error(`The approver ${approver} is not part of the contract`);
        }

        // Automatically close the contract if both parties have approved
        if (contract.ClientApproval && contract.FreelancerApproval) {
            const freelancerAccountJSON = await ctx.stub.getState(contract.Freelancer);
            const freelancerAccount = JSON.parse(freelancerAccountJSON.toString()) as Account;
            freelancerAccount.Balance += contract.Amount;
            await ctx.stub.putState(contract.Freelancer, Buffer.from(JSON.stringify(freelancerAccount)));

            contract.Status = 'CLOSED';
        }

        await ctx.stub.putState(contractID, Buffer.from(JSON.stringify(contract)));
    }

    // Cancel the contract by both parties approbation
    @Transaction()
    public async CancelContract(ctx: Context, contractID: string, approverClient: string, approverFreelancer: string) : Promise<void> {
    	const contractJSON = await ctx.stub.getState(contractID);
        const contract = JSON.parse(contractJSON.toString()) as EscrowContract;
        // Close the contract if both parties approve and the contract is opened
        if (approverClient === contract.Client && approverFreelancer === contract.Freelancer && contract.Status == 'OPEN') {
        	contract.Status = 'CLOSED';
        	await ctx.stub.putState(contractID, Buffer.from(JSON.stringify(contract)));
        }
    }
}
