import { Object, Property } from 'fabric-contract-api';

@Object()
export class Transaction {
    @Property()
    public readonly docType?: string;

    @Property()
    public ID: string;

    @Property()
    public Source: string;

    @Property()
    public Target: string;

    @Property()
    public Amount: number;

    @Property()
    public DateTime: string;
}