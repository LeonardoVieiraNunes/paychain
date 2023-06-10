import { Object, Property } from 'fabric-contract-api';

@Object()
export class Account {
    @Property()
    public readonly docType?: string;

    @Property()
    public ID: string;

    @Property()
    public Balance: number;
}