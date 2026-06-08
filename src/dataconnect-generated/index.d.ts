import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateUserData {
  user_upsert: User_Key;
}

export interface CreateUserVariables {
  id: string;
  username: string;
  email: string;
}

export interface DeleteUserData {
  user_update?: User_Key | null;
}

export interface DeleteUserVariables {
  id: string;
}

export interface GetUserByIdData {
  user?: {
    id: string;
    username: string;
    name?: string | null;
    email: string;
    role?: string | null;
    status?: string | null;
    creationDate: TimestampString;
    company?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    aboutMe?: string | null;
    profileImg?: string | null;
    posts?: string | null;
    followers?: string | null;
    following?: string | null;
    reminders?: boolean | null;
    language?: string | null;
    recentActivity?: boolean | null;
    twoFactor?: boolean | null;
    postNotifications?: boolean | null;
  } & User_Key;
}

export interface GetUserByIdVariables {
  id: string;
}

export interface ListDeletedUsersData {
  users: ({
    id: string;
    username: string;
    name?: string | null;
    email: string;
    role?: string | null;
    creationDate: TimestampString;
    status?: string | null;
  } & User_Key)[];
}

export interface ListUsersData {
  users: ({
    id: string;
    username: string;
    name?: string | null;
    email: string;
    role?: string | null;
    creationDate: TimestampString;
    status?: string | null;
  } & User_Key)[];
}

export interface RestoreUserData {
  user_update?: User_Key | null;
}

export interface RestoreUserVariables {
  id: string;
}

export interface UpdateUserData {
  user_upsert: User_Key;
}

export interface UpdateUserVariables {
  id: string;
  email: string;
  username: string;
  name?: string | null;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  aboutMe?: string | null;
  profileImg?: string | null;
  role?: string | null;
  status?: string | null;
  reminders?: boolean | null;
  language?: string | null;
  recentActivity?: boolean | null;
  twoFactor?: boolean | null;
  postNotifications?: boolean | null;
}

export interface UserReadData {
  users: ({
    id: string;
    username: string;
  } & User_Key)[];
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface UserReadRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<UserReadData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<UserReadData, undefined>;
  operationName: string;
}
export const userReadRef: UserReadRef;

export function userRead(options?: ExecuteQueryOptions): QueryPromise<UserReadData, undefined>;
export function userRead(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<UserReadData, undefined>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;
export function deleteUser(dc: DataConnect, vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface RestoreUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RestoreUserVariables): MutationRef<RestoreUserData, RestoreUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RestoreUserVariables): MutationRef<RestoreUserData, RestoreUserVariables>;
  operationName: string;
}
export const restoreUserRef: RestoreUserRef;

export function restoreUser(vars: RestoreUserVariables): MutationPromise<RestoreUserData, RestoreUserVariables>;
export function restoreUser(dc: DataConnect, vars: RestoreUserVariables): MutationPromise<RestoreUserData, RestoreUserVariables>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface GetUserByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
  operationName: string;
}
export const getUserByIdRef: GetUserByIdRef;

export function getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;
export function getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface ListDeletedUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDeletedUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListDeletedUsersData, undefined>;
  operationName: string;
}
export const listDeletedUsersRef: ListDeletedUsersRef;

export function listDeletedUsers(options?: ExecuteQueryOptions): QueryPromise<ListDeletedUsersData, undefined>;
export function listDeletedUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListDeletedUsersData, undefined>;

