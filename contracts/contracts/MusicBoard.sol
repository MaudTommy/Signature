// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MusicBoard - Decentralized music-themed message board with FHE applause
/// @notice Stores public music notes while applause counts are kept encrypted using FHE
contract MusicBoard is SepoliaConfig {
    struct NoteItem {
        uint256 id;            // Incremental ID (plaintext)
        address author;        // Author address
        string track;          // Track or song title (plaintext)
        string message;        // Message content (plaintext)
        string aliasName;      // Optional alias (plaintext)
        uint64 timestamp;      // Block timestamp (plaintext)
        euint32 applause;      // Encrypted applause counter
        uint32 applausePlain;  // Non-trustworthy plaintext mirror for fast UI sorting
    }

    event NoteAdded(uint256 indexed id, address indexed author, string track, string aliasName, uint64 timestamp);
    event NoteApplauded(uint256 indexed id, address indexed sender);

    uint256 public nextId = 1;
    mapping(uint256 => NoteItem) private _notes;

    /// @notice Publish a new music note
    function addNote(string memory track, string memory message, string memory aliasName) external returns (uint256 id) {
        require(bytes(track).length > 0 && bytes(track).length <= 100, "invalid track length");
        require(bytes(message).length > 0 && bytes(message).length <= 240, "invalid message length");
        require(bytes(aliasName).length <= 64, "invalid alias length");

        id = nextId++;

        euint32 encZero = FHE.asEuint32(0);

        _notes[id] = NoteItem({
            id: id,
            author: msg.sender,
            track: track,
            message: message,
            aliasName: aliasName,
            timestamp: uint64(block.timestamp),
            applause: encZero,
            applausePlain: 0
        });

        // Maintain ACL: contract and author can access; sender gets transient access in the tx
        FHE.allowThis(_notes[id].applause);
        FHE.allow(_notes[id].applause, msg.sender);

        emit NoteAdded(id, msg.sender, track, aliasName, uint64(block.timestamp));
    }

    /// @notice Send encrypted applause (+1) using external encrypted input and proof
    function applaudNote(uint256 id, externalEuint32 plusOneExt, bytes calldata inputProof) external {
        require(id > 0 && id < nextId, "invalid id");
        NoteItem storage it = _notes[id];
        require(it.author != address(0), "not found");

        euint32 plusOne = FHE.fromExternal(plusOneExt, inputProof);
        it.applause = FHE.add(it.applause, plusOne);

        FHE.allowThis(it.applause);
        FHE.allow(it.applause, it.author);
        FHE.allowTransient(it.applause, msg.sender);

        unchecked { it.applausePlain += 1; }

        emit NoteApplauded(id, msg.sender);
    }

    /// @notice Get the plaintext fields for a single note
    function getNote(uint256 id)
        external
        view
        returns (
            uint256 noteId,
            address author,
            string memory track,
            string memory message,
            string memory aliasName,
            uint64 timestamp
        )
    {
        require(id > 0 && id < nextId, "invalid id");
        NoteItem storage it = _notes[id];
        require(it.author != address(0), "not found");
        return (it.id, it.author, it.track, it.message, it.aliasName, it.timestamp);
    }

    /// @notice Get all notes (plaintext fields only + encrypted handle embedded in struct)
    function getNotes() external view returns (NoteItem[] memory items) {
        uint256 n = nextId - 1;
        items = new NoteItem[](n);
        for (uint256 i = 1; i <= n; i++) {
            items[i - 1] = _notes[i];
        }
    }

    /// @notice Read encrypted applause handle for a note (to be decrypted via relayer-sdk)
    function getApplauseHandle(uint256 id) external view returns (euint32) {
        require(id > 0 && id < nextId, "invalid id");
        NoteItem storage it = _notes[id];
        require(it.author != address(0), "not found");
        return it.applause;
    }

    /// @notice Read plaintext applause mirror (not trustable, UI only)
    function getApplausePlain(uint256 id) external view returns (uint32) {
        require(id > 0 && id < nextId, "invalid id");
        NoteItem storage it = _notes[id];
        require(it.author != address(0), "not found");
        return it.applausePlain;
    }
}


