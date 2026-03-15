'use strict';

// ============================================================================
// ZetrixSign Smart Contract
// ============================================================================
//
// A decentralized, immutable registry ('Source of Truth') for signed documents.
// Stores proof of existence, proof of identity, and proof of intent for every
// document signed on the platform, enabling instant cryptographic verification.
//
// Architecture:
// - Follows ES5 patterns for Zetrix VM compatibility
// - Uses BasicOperation for all object storage operations
// - Modular design with separate libraries for each feature
// - funcList routing pattern for main() and query()
//
// Features: ownable, signature verification (ecVerify), document anchoring,
//           revocation, active cryptographic validation
//
// ============================================================================

const BasicOperation = function() {

  this.loadObj = function(key) {
    let data = Chain.load(key);
    if (data !== false) {
      return JSON.parse(data);
    }

    return false;
  };

  this.saveObj = function(key, value) {
    let str = JSON.stringify(value);
    Chain.store(key, str);
  };

  this.delObj = function(key) {
    Chain.del(key);
  };

  this.getKey = function(k1, k2, k3 = '', k4 = '') {
    return (k4 === '') ? (k3 === '') ? (k1 + '_' + k2) : (k1 + '_' + k2 + '_' + k3) : (k1 + '_' + k2 + '_' + k3 + '_' + k4);
  };
};

// ============================================================================
// ZetrixSignStorage - Storage Library
// ============================================================================
//
// Manages all persistent storage for the ZetrixSign document registry.
// Provides typed save/load operations for document records and contract info.
//
// CRITICAL RULES:
// 1. ALWAYS use BasicOperation for ALL storage (saveObj/loadObj)
// 2. NEVER use Chain.store/load directly - use BasicOperation instead
// 3. Loop syntax: let i; for (i = 0; i < array.length; i += 1) { }
//
// ============================================================================

const ZetrixSignStorage = function() {
  const self = this;
  const BasicOperationUtil = new BasicOperation();

  // ---- Storage key prefixes / constants ----
  const RECORD_PREFIX = 'record';
  const CONTRACT_INFO_KEY = 'contract_info';
  const OWNER_KEY = 'owner_key';
  const RECORD_COUNT_KEY = 'record_count';

  // ---- Private helpers ----

  const _recordKey = function(documentHash) {
    return BasicOperationUtil.getKey(RECORD_PREFIX, documentHash);
  };

  // ---- Document Record operations ----

  /**
   * Check whether a record already exists for a given document hash.
   * @param {string} documentHash - SHA256 hash of the document.
   * @returns {boolean}
   */
  self.recordExists = function(documentHash) {
    let data = BasicOperationUtil.loadObj(_recordKey(documentHash));
    return data !== false;
  };

  /**
   * Save a new document record.
   * @param {string} documentHash
   * @param {object} record - { signerAddress, digitalSignature, signerPublicKey, credentialID, timestamp, isRevoked }
   */
  self.saveRecord = function(documentHash, record) {
    BasicOperationUtil.saveObj(_recordKey(documentHash), record);
  };

  /**
   * Load a document record.
   * @param {string} documentHash
   * @returns {object|false} The record object, or false if not found.
   */
  self.loadRecord = function(documentHash) {
    return BasicOperationUtil.loadObj(_recordKey(documentHash));
  };

  // ---- Contract metadata operations ----

  self.saveContractInfo = function(info) {
    BasicOperationUtil.saveObj(CONTRACT_INFO_KEY, info);
  };

  self.loadContractInfo = function() {
    let data = BasicOperationUtil.loadObj(CONTRACT_INFO_KEY);
    return data === false ? {} : data;
  };

  // ---- Owner operations ----

  self.saveOwner = function(owner) {
    BasicOperationUtil.saveObj(OWNER_KEY, owner);
  };

  self.loadOwner = function() {
    let data = BasicOperationUtil.loadObj(OWNER_KEY);
    return data === false ? '' : data;
  };

  // ---- Record count (analytics) ----

  self.incrementRecordCount = function() {
    let count = BasicOperationUtil.loadObj(RECORD_COUNT_KEY);
    if (count === false) {
      count = '0';
    }
    count = Utils.int64Add(count, '1');
    BasicOperationUtil.saveObj(RECORD_COUNT_KEY, count);
    return count;
  };

  self.getRecordCount = function() {
    let count = BasicOperationUtil.loadObj(RECORD_COUNT_KEY);
    return count === false ? '0' : count;
  };
};

// ============================================================================
// ZetrixSignValidation - Validation Library
// ============================================================================
//
// Provides input validation and cryptographic verification utilities
// for the ZetrixSign document registry contract.
//
// CRITICAL RULES:
// 1. ALWAYS use BasicOperation for ALL storage (saveObj/loadObj)
// 2. NEVER use Chain.store/load directly - use BasicOperation instead
// 3. Loop syntax: let i; for (i = 0; i < array.length; i += 1) { }
//
// ============================================================================

const ZetrixSignValidation = function() {
  const self = this;

  // ---- Address validation ----

  /**
   * Assert that a value is a valid Zetrix address.
   * @param {string} address
   * @param {string} paramName - Used in the error message.
   */
  self.requireValidAddress = function(address, paramName) {
    Utils.assert(
      address !== undefined && address !== null && address.length > 0,
      paramName + ' is required'
    );
    Utils.assert(
      Utils.addressCheck(address),
      paramName + ' must be a valid Zetrix address'
    );
  };

  // ---- String validation ----

  /**
   * Assert that a string parameter is non-empty.
   * @param {string} value
   * @param {string} paramName
   */
  self.requireNonEmpty = function(value, paramName) {
    Utils.assert(
      value !== undefined && value !== null && value.length > 0,
      paramName + ' is required and cannot be empty'
    );
  };

  // ---- Document hash validation ----

  /**
   * Assert that a document hash looks valid (64-char hex = SHA256).
   * @param {string} hash
   */
  self.requireValidDocumentHash = function(hash) {
    self.requireNonEmpty(hash, 'documentHash');
    Utils.assert(
      hash.length === 64,
      'documentHash must be a 64-character SHA256 hex string'
    );
  };

  // ---- Cryptographic verification ----

  /**
   * Verify that a public key resolves to the expected Zetrix address.
   * This is the Zetrix equivalent of the address-derivation step in ecrecover.
   *
   * @param {string} publicKey - Ed25519 public key (hex).
   * @param {string} expectedAddress - The Zetrix address to match.
   * @returns {boolean}
   */
  self.publicKeyMatchesAddress = function(publicKey, expectedAddress) {
    let derivedAddress = Utils.toAddress(publicKey);
    return derivedAddress === expectedAddress;
  };

  /**
   * Verify a digital signature against a document hash and public key.
   * Uses Utils.ecVerify (Ed25519 signature verification on Zetrix VM).
   *
   * @param {string} digitalSignature - The signature (hex).
   * @param {string} signerPublicKey  - The public key (hex).
   * @param {string} documentHash     - The original data that was signed (hex).
   * @returns {boolean}
   */
  self.verifySignature = function(digitalSignature, signerPublicKey, documentHash) {
    return Utils.ecVerify(digitalSignature, signerPublicKey, documentHash);
  };

  /**
   * Full 'active validation' — the Zetrix equivalent of ecrecover.
   * 1. Verify signature(documentHash, publicKey) matches digitalSignature.
   * 2. Verify toAddress(publicKey) === signerAddress.
   *
   * @param {string} documentHash
   * @param {string} digitalSignature
   * @param {string} signerPublicKey
   * @param {string} signerAddress
   * @returns {boolean} true only if both cryptographic checks pass.
   */
  self.activeValidate = function(documentHash, digitalSignature, signerPublicKey, signerAddress) {
    // Step 1 — signature validity
    let sigValid = self.verifySignature(digitalSignature, signerPublicKey, documentHash);
    if (!sigValid) {
      return false;
    }

    // Step 2 — address derivation (identity chain)
    let addressMatch = self.publicKeyMatchesAddress(signerPublicKey, signerAddress);
    return addressMatch;
  };
};

// ============================================================================
// ZetrixSignOwnable - Ownership Library
// ============================================================================
//
// Manages contract ownership for administrative operations.
// The owner is set during init() and can be transferred.
//
// CRITICAL RULES:
// 1. ALWAYS use BasicOperation for ALL storage (saveObj/loadObj)
// 2. NEVER use Chain.store/load directly - use BasicOperation instead
// 3. Loop syntax: let i; for (i = 0; i < array.length; i += 1) { }
//
// ============================================================================

const ZetrixSignOwnable = function() {
  const self = this;
  const StorageInst = new ZetrixSignStorage();

  /**
   * Assert that the caller (Chain.msg.sender) is the contract owner.
   * Reverts with an error if not.
   */
  self.requireOwner = function() {
    let owner = StorageInst.loadOwner();
    Utils.assert(
      Chain.msg.sender === owner,
      'Only the contract owner can perform this action'
    );
  };

  /**
   * Set the initial owner (called once during init).
   * @param {string} ownerAddress
   */
  self.initOwner = function(ownerAddress) {
    Utils.assert(
      Utils.addressCheck(ownerAddress),
      'Invalid owner address'
    );
    StorageInst.saveOwner(ownerAddress);
  };

  /**
   * Transfer ownership to a new address.
   * Only callable by the current owner.
   * @param {string} newOwner
   */
  self.transferOwnership = function(newOwner) {
    self.requireOwner();
    Utils.assert(
      Utils.addressCheck(newOwner),
      'New owner address is invalid'
    );
    let oldOwner = StorageInst.loadOwner();
    StorageInst.saveOwner(newOwner);
    Chain.tlog('OwnershipTransferred', oldOwner, newOwner);
  };

  /**
   * Return the current owner address.
   * @returns {string}
   */
  self.owner = function() {
    return StorageInst.loadOwner();
  };
};

const BasicOperationUtil = new BasicOperation();
const ZetrixSignStorageInst = new ZetrixSignStorage();
const ZetrixSignValidationInst = new ZetrixSignValidation();
const ZetrixSignOwnableInst = new ZetrixSignOwnable();

// ============================================================================
// CONTRACT INITIALIZATION
// ============================================================================

function init(input) {
  let params = JSON.parse(input).params;

  // Validate required parameters
  Utils.assert(params !== undefined && params !== null, 'Initialization params are required');
  Utils.assert(params.name !== undefined && params.name.length > 0, 'Contract name is required');

  // Set the contract owner to the deployer
  let owner = params.owner || Chain.msg.sender;
  ZetrixSignOwnableInst.initOwner(owner);

  // Store contract metadata
  let contractInfo = {
    name: params.name,
    version: '1.0.0',
    owner: owner,
    deployedAt: Chain.block.timestamp
  };
  ZetrixSignStorageInst.saveContractInfo(contractInfo);

  Chain.tlog('ContractInitialized', params.name, owner);
  return true;
}

// ============================================================================
// TRANSACTION FUNCTIONS (state-changing, called via main)
// ============================================================================

/**
 * anchorDocument — Records a new signed document on the blockchain.
 *
 * Pre-conditions:
 *   - documentHash must NOT already exist in the registry (one-time write).
 *   - signerPublicKey must derive to Chain.msg.sender (prevents identity spoofing).
 *
 * Stored bundle:
 *   { signerAddress, digitalSignature, signerPublicKey, credentialID, timestamp, isRevoked }
 *
 * @param {object} params
 * @param {string} params.documentHash      - SHA256 hex hash of the PDF content (64 chars).
 * @param {string} params.digitalSignature  - Cryptographic signature of the document hash.
 * @param {string} params.signerPublicKey   - Ed25519 public key of the signer.
 * @param {string} params.credentialID      - Identifier of the Verifiable Credential.
 */
function anchorDocument(params) {
  // ---- Input validation ----
  ZetrixSignValidationInst.requireValidDocumentHash(params.documentHash);
  ZetrixSignValidationInst.requireNonEmpty(params.digitalSignature, 'digitalSignature');
  ZetrixSignValidationInst.requireNonEmpty(params.signerPublicKey, 'signerPublicKey');
  ZetrixSignValidationInst.requireNonEmpty(params.credentialID, 'credentialID');

  // ---- Integrity: one-time write ----
  Utils.assert(
    !ZetrixSignStorageInst.recordExists(params.documentHash),
    'Document already anchored: a record for this documentHash already exists'
  );

  // ---- Authorization: derive signerAddress from transaction, NOT from input ----
  let signerAddress = Chain.msg.sender;

  // ---- Identity chain: verify publicKey maps to the calling address ----
  Utils.assert(
    ZetrixSignValidationInst.publicKeyMatchesAddress(params.signerPublicKey, signerAddress),
    'signerPublicKey does not correspond to the transaction sender address'
  );

  // ---- Build and store the record ----
  let record = {
    signerAddress: signerAddress,
    digitalSignature: params.digitalSignature,
    signerPublicKey: params.signerPublicKey,
    credentialID: params.credentialID,
    timestamp: Chain.block.timestamp,
    isRevoked: false
  };

  ZetrixSignStorageInst.saveRecord(params.documentHash, record);
  ZetrixSignStorageInst.incrementRecordCount();

  Chain.tlog('DocumentAnchored', params.documentHash, signerAddress, params.credentialID);
}

/**
 * revokeDocument — Invalidates a previously signed document.
 *
 * Authorization: Only the original signerAddress may revoke.
 * Effect: Sets isRevoked = true on the stored record.
 *
 * @param {object} params
 * @param {string} params.documentHash - SHA256 hex hash of the document to revoke.
 */
function revokeDocument(params) {
  // ---- Input validation ----
  ZetrixSignValidationInst.requireValidDocumentHash(params.documentHash);

  // ---- Load existing record ----
  let record = ZetrixSignStorageInst.loadRecord(params.documentHash);
  Utils.assert(record !== false, 'No record found for this documentHash');

  // ---- Authorization: only original signer can revoke ----
  Utils.assert(
    Chain.msg.sender === record.signerAddress,
    'Only the original signer can revoke this document'
  );

  // ---- Prevent double-revocation noise ----
  Utils.assert(
    record.isRevoked === false,
    'Document is already revoked'
  );

  // ---- Update revocation flag ----
  record.isRevoked = true;
  ZetrixSignStorageInst.saveRecord(params.documentHash, record);

  Chain.tlog('DocumentRevoked', params.documentHash, Chain.msg.sender);
}

/**
 * transferOwnership — Transfers contract ownership.
 * Only callable by the current owner.
 *
 * @param {object} params
 * @param {string} params.newOwner - The new owner's Zetrix address.
 */
function transferOwnership(params) {
  ZetrixSignValidationInst.requireValidAddress(params.newOwner, 'newOwner');
  ZetrixSignOwnableInst.transferOwnership(params.newOwner);
}

// ============================================================================
// QUERY FUNCTIONS (read-only, called via query)
// ============================================================================

/**
 * getRecord — Returns the full data bundle for a document hash.
 *
 * @param {object} params
 * @param {string} params.documentHash
 * @returns {object} { signerAddress, digitalSignature, signerPublicKey, credentialID, timestamp, isRevoked }
 */
function getRecord(params) {
  ZetrixSignValidationInst.requireValidDocumentHash(params.documentHash);

  let record = ZetrixSignStorageInst.loadRecord(params.documentHash);
  if (record === false) {
    return {
      exists: false
    };
  }

  return {
    exists: true,
    signerAddress: record.signerAddress,
    digitalSignature: record.digitalSignature,
    signerPublicKey: record.signerPublicKey,
    credentialID: record.credentialID,
    timestamp: record.timestamp,
    isRevoked: record.isRevoked
  };
}

/**
 * isValidated — Active cryptographic validator.
 *
 * Logic:
 *   1. Look up record for documentHash.
 *   2. If record does not exist OR isRevoked is true → return false.
 *   3. ecVerify(digitalSignature, signerPublicKey, documentHash) — signature check.
 *   4. toAddress(signerPublicKey) === signerAddress — identity chain check.
 *   5. Return true only if the math matches the stored identity.
 *
 * @param {object} params
 * @param {string} params.documentHash
 * @returns {object} { isValid: boolean, reason: string }
 */
function isValidated(params) {
  ZetrixSignValidationInst.requireValidDocumentHash(params.documentHash);

  // Step 1 — lookup
  let record = ZetrixSignStorageInst.loadRecord(params.documentHash);

  // Step 2 — existence check
  if (record === false) {
    return {
      isValid: false,
      reason: 'No record found for this documentHash'
    };
  }

  // Step 2 — revocation check
  if (record.isRevoked === true) {
    return {
      isValid: false,
      reason: 'Document has been revoked'
    };
  }

  // Steps 3 & 4 — cryptographic verification (ecrecover equivalent)
  let cryptoValid = ZetrixSignValidationInst.activeValidate(
    params.documentHash,
    record.digitalSignature,
    record.signerPublicKey,
    record.signerAddress
  );

  if (!cryptoValid) {
    return {
      isValid: false,
      reason: 'Cryptographic verification failed'
    };
  }

  // Step 5 — all checks passed
  return {
    isValid: true,
    reason: 'Document is valid and cryptographically verified',
    signerAddress: record.signerAddress,
    credentialID: record.credentialID,
    timestamp: record.timestamp
  };
}

/**
 * getContractInfo — Returns contract metadata.
 * @returns {object}
 */
function getContractInfo() {
  let info = ZetrixSignStorageInst.loadContractInfo();
  info.totalRecords = ZetrixSignStorageInst.getRecordCount();
  info.owner = ZetrixSignOwnableInst.owner();
  return info;
}

/**
 * getOwner — Returns the current contract owner.
 * @returns {object}
 */
function getOwner() {
  return {
    owner: ZetrixSignOwnableInst.owner()
  };
}

// ============================================================================
// PUBLIC CONTRACT ENTRY POINTS
// ============================================================================

function main(input_str) {
  let funcList = {
    'anchorDocument': anchorDocument,
    'revokeDocument': revokeDocument,
    'transferOwnership': transferOwnership
  };

  let inputObj = JSON.parse(input_str);
  Utils.assert(
    funcList.hasOwnProperty(inputObj.method) && typeof funcList[inputObj.method] === 'function',
    'Unknown transaction method: ' + inputObj.method
  );
  funcList[inputObj.method](inputObj.params);
}

function query(input_str) {
  let funcList = {
    'getRecord': getRecord,
    'isValidated': isValidated,
    'getContractInfo': getContractInfo,
    'getOwner': getOwner
  };

  let inputObj = JSON.parse(input_str);
  Utils.assert(
    funcList.hasOwnProperty(inputObj.method) && typeof funcList[inputObj.method] === 'function',
    'Unknown query method: ' + inputObj.method
  );
  return JSON.stringify(funcList[inputObj.method](inputObj.params));
}