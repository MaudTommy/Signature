export type AddressEntry = { chainId: number; chainName: string; address: string };
export type AddressBook = Record<string, AddressEntry>;
export const MusicBoardAddresses: AddressBook = {
  "11155111": { chainId: 11155111, chainName: "Sepolia", address: "0x86d708CAb1394F9F6dbe4a96441e2A58B166cbC7" }
};


