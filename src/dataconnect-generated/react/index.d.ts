import { CreateUserData, CreateUserVariables, UserReadData, UpdateUserData, UpdateUserVariables, DeleteUserData, DeleteUserVariables, RestoreUserData, RestoreUserVariables, ListUsersData, GetUserByIdData, GetUserByIdVariables, ListDeletedUsersData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;

export function useUserRead(options?: useDataConnectQueryOptions<UserReadData>): UseDataConnectQueryResult<UserReadData, undefined>;
export function useUserRead(dc: DataConnect, options?: useDataConnectQueryOptions<UserReadData>): UseDataConnectQueryResult<UserReadData, undefined>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, DeleteUserVariables>): UseDataConnectMutationResult<DeleteUserData, DeleteUserVariables>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, DeleteUserVariables>): UseDataConnectMutationResult<DeleteUserData, DeleteUserVariables>;

export function useRestoreUser(options?: useDataConnectMutationOptions<RestoreUserData, FirebaseError, RestoreUserVariables>): UseDataConnectMutationResult<RestoreUserData, RestoreUserVariables>;
export function useRestoreUser(dc: DataConnect, options?: useDataConnectMutationOptions<RestoreUserData, FirebaseError, RestoreUserVariables>): UseDataConnectMutationResult<RestoreUserData, RestoreUserVariables>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useGetUserById(vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;
export function useGetUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: useDataConnectQueryOptions<GetUserByIdData>): UseDataConnectQueryResult<GetUserByIdData, GetUserByIdVariables>;

export function useListDeletedUsers(options?: useDataConnectQueryOptions<ListDeletedUsersData>): UseDataConnectQueryResult<ListDeletedUsersData, undefined>;
export function useListDeletedUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListDeletedUsersData>): UseDataConnectQueryResult<ListDeletedUsersData, undefined>;
