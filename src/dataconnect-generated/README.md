# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*UserRead*](#userread)
  - [*ListUsers*](#listusers)
  - [*GetUserById*](#getuserbyid)
  - [*ListDeletedUsers*](#listdeletedusers)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateUser*](#updateuser)
  - [*DeleteUser*](#deleteuser)
  - [*RestoreUser*](#restoreuser)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## UserRead
You can execute the `UserRead` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
userRead(options?: ExecuteQueryOptions): QueryPromise<UserReadData, undefined>;

interface UserReadRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<UserReadData, undefined>;
}
export const userReadRef: UserReadRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
userRead(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<UserReadData, undefined>;

interface UserReadRef {
  ...
  (dc: DataConnect): QueryRef<UserReadData, undefined>;
}
export const userReadRef: UserReadRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the userReadRef:
```typescript
const name = userReadRef.operationName;
console.log(name);
```

### Variables
The `UserRead` query has no variables.
### Return Type
Recall that executing the `UserRead` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UserReadData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UserReadData {
  users: ({
    id: string;
    username: string;
  } & User_Key)[];
}
```
### Using `UserRead`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, userRead } from '@dataconnect/generated';


// Call the `userRead()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await userRead();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await userRead(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
userRead().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `UserRead`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, userReadRef } from '@dataconnect/generated';


// Call the `userReadRef()` function to get a reference to the query.
const ref = userReadRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = userReadRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetUserById
You can execute the `GetUserById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUserById(vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUserById(dc: DataConnect, vars: GetUserByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetUserByIdData, GetUserByIdVariables>;

interface GetUserByIdRef {
  ...
  (dc: DataConnect, vars: GetUserByIdVariables): QueryRef<GetUserByIdData, GetUserByIdVariables>;
}
export const getUserByIdRef: GetUserByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserByIdRef:
```typescript
const name = getUserByIdRef.operationName;
console.log(name);
```

### Variables
The `GetUserById` query requires an argument of type `GetUserByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetUserByIdVariables {
  id: string;
}
```
### Return Type
Recall that executing the `GetUserById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetUserById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUserById, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUserById(getUserByIdVars);
// Variables can be defined inline as well.
const { data } = await getUserById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUserById(dataConnect, getUserByIdVars);

console.log(data.user);

// Or, you can use the `Promise` API.
getUserById(getUserByIdVars).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUserById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserByIdRef, GetUserByIdVariables } from '@dataconnect/generated';

// The `GetUserById` query requires an argument of type `GetUserByIdVariables`:
const getUserByIdVars: GetUserByIdVariables = {
  id: ..., 
};

// Call the `getUserByIdRef()` function to get a reference to the query.
const ref = getUserByIdRef(getUserByIdVars);
// Variables can be defined inline as well.
const ref = getUserByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserByIdRef(dataConnect, getUserByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListDeletedUsers
You can execute the `ListDeletedUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listDeletedUsers(options?: ExecuteQueryOptions): QueryPromise<ListDeletedUsersData, undefined>;

interface ListDeletedUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListDeletedUsersData, undefined>;
}
export const listDeletedUsersRef: ListDeletedUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listDeletedUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListDeletedUsersData, undefined>;

interface ListDeletedUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListDeletedUsersData, undefined>;
}
export const listDeletedUsersRef: ListDeletedUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listDeletedUsersRef:
```typescript
const name = listDeletedUsersRef.operationName;
console.log(name);
```

### Variables
The `ListDeletedUsers` query has no variables.
### Return Type
Recall that executing the `ListDeletedUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListDeletedUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListDeletedUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listDeletedUsers } from '@dataconnect/generated';


// Call the `listDeletedUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listDeletedUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listDeletedUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listDeletedUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListDeletedUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listDeletedUsersRef } from '@dataconnect/generated';


// Call the `listDeletedUsersRef()` function to get a reference to the query.
const ref = listDeletedUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listDeletedUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  id: string;
  username: string;
  email: string;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_upsert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  id: ..., 
  username: ..., 
  email: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ id: ..., username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  id: ..., 
  username: ..., 
  email: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ id: ..., username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## UpdateUser
You can execute the `UpdateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUser(vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUser(dc: DataConnect, vars: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  (dc: DataConnect, vars: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRef:
```typescript
const name = updateUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `UpdateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserData {
  user_upsert: User_Key;
}
```
### Using `UpdateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUser, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  id: ..., 
  email: ..., 
  username: ..., 
  name: ..., // optional
  company: ..., // optional
  address: ..., // optional
  city: ..., // optional
  postalCode: ..., // optional
  country: ..., // optional
  aboutMe: ..., // optional
  profileImg: ..., // optional
  role: ..., // optional
  status: ..., // optional
  reminders: ..., // optional
  language: ..., // optional
  recentActivity: ..., // optional
  twoFactor: ..., // optional
  postNotifications: ..., // optional
};

// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser(updateUserVars);
// Variables can be defined inline as well.
const { data } = await updateUser({ id: ..., email: ..., username: ..., name: ..., company: ..., address: ..., city: ..., postalCode: ..., country: ..., aboutMe: ..., profileImg: ..., role: ..., status: ..., reminders: ..., language: ..., recentActivity: ..., twoFactor: ..., postNotifications: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUser(dataConnect, updateUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
updateUser(updateUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpdateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRef, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation requires an argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  id: ..., 
  email: ..., 
  username: ..., 
  name: ..., // optional
  company: ..., // optional
  address: ..., // optional
  city: ..., // optional
  postalCode: ..., // optional
  country: ..., // optional
  aboutMe: ..., // optional
  profileImg: ..., // optional
  role: ..., // optional
  status: ..., // optional
  reminders: ..., // optional
  language: ..., // optional
  recentActivity: ..., // optional
  twoFactor: ..., // optional
  postNotifications: ..., // optional
};

// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef(updateUserVars);
// Variables can be defined inline as well.
const ref = updateUserRef({ id: ..., email: ..., username: ..., name: ..., company: ..., address: ..., city: ..., postalCode: ..., country: ..., aboutMe: ..., profileImg: ..., role: ..., status: ..., reminders: ..., language: ..., recentActivity: ..., twoFactor: ..., postNotifications: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRef(dataConnect, updateUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## DeleteUser
You can execute the `DeleteUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUser(vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface DeleteUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
}
export const deleteUserRef: DeleteUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUser(dc: DataConnect, vars: DeleteUserVariables): MutationPromise<DeleteUserData, DeleteUserVariables>;

interface DeleteUserRef {
  ...
  (dc: DataConnect, vars: DeleteUserVariables): MutationRef<DeleteUserData, DeleteUserVariables>;
}
export const deleteUserRef: DeleteUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserRef:
```typescript
const name = deleteUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteUserVariables {
  id: string;
}
```
### Return Type
Recall that executing the `DeleteUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserData {
  user_update?: User_Key | null;
}
```
### Using `DeleteUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUser, DeleteUserVariables } from '@dataconnect/generated';

// The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`:
const deleteUserVars: DeleteUserVariables = {
  id: ..., 
};

// Call the `deleteUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUser(deleteUserVars);
// Variables can be defined inline as well.
const { data } = await deleteUser({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUser(dataConnect, deleteUserVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
deleteUser(deleteUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `DeleteUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserRef, DeleteUserVariables } from '@dataconnect/generated';

// The `DeleteUser` mutation requires an argument of type `DeleteUserVariables`:
const deleteUserVars: DeleteUserVariables = {
  id: ..., 
};

// Call the `deleteUserRef()` function to get a reference to the mutation.
const ref = deleteUserRef(deleteUserVars);
// Variables can be defined inline as well.
const ref = deleteUserRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserRef(dataConnect, deleteUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## RestoreUser
You can execute the `RestoreUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
restoreUser(vars: RestoreUserVariables): MutationPromise<RestoreUserData, RestoreUserVariables>;

interface RestoreUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RestoreUserVariables): MutationRef<RestoreUserData, RestoreUserVariables>;
}
export const restoreUserRef: RestoreUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
restoreUser(dc: DataConnect, vars: RestoreUserVariables): MutationPromise<RestoreUserData, RestoreUserVariables>;

interface RestoreUserRef {
  ...
  (dc: DataConnect, vars: RestoreUserVariables): MutationRef<RestoreUserData, RestoreUserVariables>;
}
export const restoreUserRef: RestoreUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the restoreUserRef:
```typescript
const name = restoreUserRef.operationName;
console.log(name);
```

### Variables
The `RestoreUser` mutation requires an argument of type `RestoreUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RestoreUserVariables {
  id: string;
}
```
### Return Type
Recall that executing the `RestoreUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RestoreUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RestoreUserData {
  user_update?: User_Key | null;
}
```
### Using `RestoreUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, restoreUser, RestoreUserVariables } from '@dataconnect/generated';

// The `RestoreUser` mutation requires an argument of type `RestoreUserVariables`:
const restoreUserVars: RestoreUserVariables = {
  id: ..., 
};

// Call the `restoreUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await restoreUser(restoreUserVars);
// Variables can be defined inline as well.
const { data } = await restoreUser({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await restoreUser(dataConnect, restoreUserVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
restoreUser(restoreUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `RestoreUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, restoreUserRef, RestoreUserVariables } from '@dataconnect/generated';

// The `RestoreUser` mutation requires an argument of type `RestoreUserVariables`:
const restoreUserVars: RestoreUserVariables = {
  id: ..., 
};

// Call the `restoreUserRef()` function to get a reference to the mutation.
const ref = restoreUserRef(restoreUserVars);
// Variables can be defined inline as well.
const ref = restoreUserRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = restoreUserRef(dataConnect, restoreUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

