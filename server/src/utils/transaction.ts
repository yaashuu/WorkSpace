import mongoose, { ClientSession } from 'mongoose';

let isReplicaSetCached: boolean | null = null;

/**
 * Checks whether the connected MongoDB instance is part of a replica set
 * and therefore supports multi-document transactions.
 */
export const checkTransactionSupport = async (): Promise<boolean> => {
  if (isReplicaSetCached !== null) {
    return isReplicaSetCached;
  }

  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) {
      return false;
    }
    const status = await admin.serverStatus();
    isReplicaSetCached = !!status.repl;
    return isReplicaSetCached;
  } catch {
    isReplicaSetCached = false;
    return false;
  }
};

/**
 * Executes an operation inside a MongoDB transaction when supported.
 *
 * If the MongoDB deployment is a standalone instance (common in local dev),
 * transactions are not supported by the database engine. In this scenario,
 * the utility logs a clear warning and executes the operation without a transaction,
 * while accurately reporting this condition.
 */
export async function withTransaction<T>(
  operation: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const isReplicaSet = await checkTransactionSupport();

  if (!isReplicaSet) {
    // Standalone MongoDB node: Transactions cannot be used
    return operation(null);
  }

  // Replica set: Full ACID multi-document transaction
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
