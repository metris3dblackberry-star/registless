import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface Comment_Key {
  id: UUIDString;
  __typename?: 'Comment_Key';
}

export interface Connection_Key {
  initiatorId: UUIDString;
  recipientId: UUIDString;
  __typename?: 'Connection_Key';
}

export interface CreateCommentData {
  comment_insert: Comment_Key;
}

export interface CreateCommentVariables {
  documentId: UUIDString;
  content: string;
}

export interface DocumentInteraction_Key {
  userId: UUIDString;
  documentId: UUIDString;
  interactionType: string;
  __typename?: 'DocumentInteraction_Key';
}

export interface Document_Key {
  id: UUIDString;
  __typename?: 'Document_Key';
}

export interface GetCommentsForDocumentData {
  comments: ({
    id: UUIDString;
    content: string;
    createdAt: TimestampString;
    user: {
      id: UUIDString;
      username: string;
      displayName?: string | null;
      profilePictureUrl?: string | null;
    } & User_Key;
  } & Comment_Key)[];
}

export interface GetCommentsForDocumentVariables {
  documentId: UUIDString;
}

export interface GetUserProfileByIdData {
  user?: {
    id: UUIDString;
    username: string;
    email: string;
    displayName?: string | null;
    bio?: string | null;
    profilePictureUrl?: string | null;
    createdAt: TimestampString;
  } & User_Key;
}

export interface GetUserProfileByIdVariables {
  userId: UUIDString;
}

export interface ListAllDocumentsData {
  documents: ({
    id: UUIDString;
    title: string;
    documentType: string;
    contentUrl: string;
    description?: string | null;
    tags?: string[] | null;
    thumbnailUrl?: string | null;
    createdAt: TimestampString;
  } & Document_Key)[];
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'GetUserProfileById' Query. Allow users to execute without passing in DataConnect. */
export function getUserProfileById(dc: DataConnect, vars: GetUserProfileByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserProfileByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetUserProfileById' Query. Allow users to pass in custom DataConnect instances. */
export function getUserProfileById(vars: GetUserProfileByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetUserProfileByIdData>>;

/** Generated Node Admin SDK operation action function for the 'ListAllDocuments' Query. Allow users to execute without passing in DataConnect. */
export function listAllDocuments(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDocumentsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAllDocuments' Query. Allow users to pass in custom DataConnect instances. */
export function listAllDocuments(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAllDocumentsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateComment' Mutation. Allow users to execute without passing in DataConnect. */
export function createComment(dc: DataConnect, vars: CreateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommentData>>;
/** Generated Node Admin SDK operation action function for the 'CreateComment' Mutation. Allow users to pass in custom DataConnect instances. */
export function createComment(vars: CreateCommentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateCommentData>>;

/** Generated Node Admin SDK operation action function for the 'GetCommentsForDocument' Query. Allow users to execute without passing in DataConnect. */
export function getCommentsForDocument(dc: DataConnect, vars: GetCommentsForDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommentsForDocumentData>>;
/** Generated Node Admin SDK operation action function for the 'GetCommentsForDocument' Query. Allow users to pass in custom DataConnect instances. */
export function getCommentsForDocument(vars: GetCommentsForDocumentVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetCommentsForDocumentData>>;

