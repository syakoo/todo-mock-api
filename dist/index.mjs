/*!
  @syakoo/todo-mock-api v0.0.2
  https://github.com/syakoo/todo-mock-api#readme
  Released under the MIT License.
*/
import { rest, setupWorker } from 'msw';
import { Base64 } from 'js-base64';
import { setupServer } from 'msw/node';

function setupLocalStorage() {
    const LOCAL_STORAGE_KEY = 'TODO_MOCK_API_STORAGE_KEY';
    const store = {
        getData: () => {
            const data = localStorage.getItem(LOCAL_STORAGE_KEY);
            return data && JSON.parse(data);
        },
        setData: (state) => {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        },
    };
    return store;
}

/**
 * オブジェクトをディープコピーして readonly を解除する
 */
function deepCopyWithWriteable(object) {
    // Note: ディープコピーした結果はいじっても問題ないので readonly を消す
    // 消したくないのであれば structuredClone をそのまま使ってくれ
    return structuredClone(object);
}

/**
 * エラークラス
 */
class CustomError extends Error {
    code;
    constructor(message, code) {
        super(message);
        // 開発者用のエラーメッセージ
        this.message = message;
        // アプリのエラーコード
        this.code = code;
    }
    toJson() {
        return {
            code: this.code,
            message: this.message,
        };
    }
}

class TokenError extends CustomError {
}

function assertValidToken(token) {
    if (token === undefined)
        return;
    if (typeof token !== 'string') {
        throw new TokenError('トークンが文字列ではありません', 'InvalidToken');
    }
    if (!/^[0-9a-zA-Z-._~+/]+=*$/.test(token)) {
        throw new TokenError('トークンは token68 の形式である必要があります', 'InvalidToken');
    }
}
function checkAndGetBearerToken(value) {
    if (typeof value !== 'string') {
        throw new TokenError('bearer token が文字列ではありません。設定されていない可能性があります。', 'InvalidToken');
    }
    const regexBearerToken = /Bearer\s+(?<token>\S*)/;
    const matchedToken = value.match(regexBearerToken);
    const token = matchedToken?.groups?.token;
    if (!token) {
        throw new TokenError('token が見つかりませんでした。', 'InvalidToken');
    }
    assertValidToken(token);
    return token;
}

async function getUserFromToken(props) {
    const { input, state } = props;
    const cloneState = deepCopyWithWriteable(state);
    if (input.maybeBearerToken === null) {
        throw new TokenError('リスエストヘッダに Authorization が存在しません', 'TokenRequired');
    }
    const token = checkAndGetBearerToken(input.maybeBearerToken);
    const user = cloneState.users.find((u) => u.token === token);
    if (!user) {
        throw new TokenError('トークンの値に該当するユーザーが見つかりませんでした', 'MismatchedToken');
    }
    return user;
}

function isUnknownRecord(value) {
    return value !== null && typeof value === 'object';
}

class UserError extends CustomError {
}

function assertValidUserName(username) {
    if (typeof username !== 'string') {
        throw new UserError('ユーザー名が文字列ではありません', 'InvalidUser');
    }
}
function assertValidPassword(password) {
    if (typeof password !== 'string') {
        throw new UserError('パスワードが文字列ではありません', 'InvalidUser');
    }
}
function assertValidUserId(maybeUserId) {
    if (typeof maybeUserId !== 'string') {
        throw new UserError('ユーザー ID が文字列ではありません', 'InvalidUser');
    }
}
function assertValidUser(state) {
    if (!isUnknownRecord(state)) {
        throw new UserError('ユーザーの値が無効です', 'InvalidUser');
    }
    assertValidUserName(state.username);
    assertValidPassword(state.password);
    assertValidToken(state.token);
}
function assertValidUserState(state) {
    assertValidUser(state);
    assertValidUserId(state.id);
}

const defaultGlobalState = {
    users: [
        {
            username: 'guest',
            password: 'password',
            id: 'GUEST_ID',
        },
    ],
    tasks: [],
};
function isValidGlobalState(state) {
    if (!state)
        return false;
    if (typeof state !== 'object')
        return false;
    if (!Array.isArray(state.users))
        return false;
    if (!Array.isArray(state.tasks))
        return false;
    try {
        for (const user of state.users) {
            assertValidUserState(user);
        }
    }
    catch (error) {
        console.error(error);
        return false;
    }
    return true;
}

function createGlobalStorage(option) {
    const store = initStore(option);
    let globalState = store.getData();
    const updateGlobalState = (state) => {
        store.setData(state);
        globalState = state;
    };
    return {
        get globalState() {
            return globalState;
        },
        updateGlobalState,
    };
}
function initStore(option) {
    if (option?.storeType === 'nothing') {
        return {
            getData: () => {
                return option?.initialState || defaultGlobalState;
            },
            setData: () => {
                // don't anything
            },
        };
    }
    // この時点では GlobalState は確定していない
    const store = setupLocalStorage();
    try {
        if (option?.initialState) {
            store.setData(option.initialState);
        }
        if (!store.getData()) {
            store.setData(defaultGlobalState);
        }
    }
    catch (error) {
        throw new Error('保存されているデータが正しい形式ではありません. データを削除するか、正しい形式に修正してください.');
    }
    if (!isValidGlobalState(store.getData())) {
        throw new Error('保存されているデータが正しい形式ではありません. データを削除するか、正しい形式に修正してください.');
    }
    return store;
}

async function sha256(text) {
    const uint8 = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', uint8);
    return Array.from(new Uint8Array(digest))
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
}

async function addTask(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const createdAt = new Date().toISOString();
    const id = await sha256(`${input.user}:${createdAt}`);
    const task = {
        ...input.task,
        id,
        is_complete: false,
        created_at: createdAt,
    };
    newState.tasks.push({
        ...task,
        userId: input.user.id,
    });
    return {
        state: newState,
        output: {
            task: task,
        },
    };
}

class TaskError extends CustomError {
}

async function deleteTask(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const taskState = newState.tasks.find((t) => t.userId === input.user.id && t.id === input.id);
    if (!taskState) {
        throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
    }
    newState.tasks = newState.tasks.filter((t) => !(t.userId === input.user.id && t.id === input.id));
    return {
        state: newState,
    };
}

async function getTasks(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const tasksState = newState.tasks.filter((t) => t.userId === input.user.id);
    const tasks = tasksState.map((t) => {
        return {
            id: t.id,
            title: t.title,
            detail: t.detail,
            is_complete: t.is_complete,
            created_at: t.created_at,
        };
    });
    return {
        output: {
            tasks,
        },
    };
}

async function getTask(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const taskState = newState.tasks.find((t) => t.userId === input.user.id && t.id === input.id);
    if (!taskState) {
        throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
    }
    const task = {
        id: taskState.id,
        title: taskState.title,
        detail: taskState.detail,
        is_complete: taskState.is_complete,
        created_at: taskState.created_at,
    };
    return {
        output: {
            task,
        },
    };
}

const changeableTaskParamKey = ['title', 'detail'];
async function updateTask(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const taskState = newState.tasks.find((t) => t.userId === input.user.id && t.id === input.id);
    if (!taskState) {
        throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
    }
    for (const k of changeableTaskParamKey) {
        const v = input.incomingPartialTask[k];
        // NOTE: detail は undefined 可なので弾いていいのか...
        if (v !== undefined) {
            taskState[k] = v;
        }
    }
    const task = {
        id: taskState.id,
        title: taskState.title,
        detail: taskState.detail,
        is_complete: taskState.is_complete,
        created_at: taskState.created_at,
    };
    return {
        state: newState,
        output: {
            task,
        },
    };
}

async function updateTaskCompletion(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    const taskState = newState.tasks.find((t) => t.userId === input.user.id && t.id === input.id);
    if (!taskState) {
        throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
    }
    taskState.is_complete = input.isComplete;
    const task = {
        id: taskState.id,
        title: taskState.title,
        detail: taskState.detail,
        is_complete: input.isComplete,
        created_at: taskState.created_at,
    };
    return {
        state: newState,
        output: {
            task,
        },
    };
}

function assertValidTaskId(maybeTaskId) {
    if (typeof maybeTaskId !== 'string') {
        throw new TaskError('タスク ID が文字列ではありません', 'InvalidTask');
    }
}
function assertValidTaskTitle(maybeTaskTitle) {
    if (typeof maybeTaskTitle !== 'string') {
        throw new TaskError('タスクタイトルが文字列ではありません', 'InvalidTask');
    }
}
function assertValidTaskDetail(maybeTaskDetail) {
    if (maybeTaskDetail === undefined)
        return;
    if (typeof maybeTaskDetail !== 'string') {
        throw new TaskError('タスク詳細が文字列ではありません', 'InvalidTask');
    }
}
function assertValidIncomingPartialTask(maybeIncomingPartialTask) {
    if (!isUnknownRecord(maybeIncomingPartialTask)) {
        throw new TaskError('タスクがオブジェクト型ではありません', 'InvalidTask');
    }
    if ('title' in maybeIncomingPartialTask) {
        assertValidTaskTitle(maybeIncomingPartialTask.title);
    }
    if ('detail' in maybeIncomingPartialTask) {
        assertValidTaskDetail(maybeIncomingPartialTask.detail);
    }
}

function error2HttpErrorResponse(error) {
    if (!(error instanceof CustomError)) {
        return {
            status: 500,
            body: {
                code: 'UnexpectedError',
                message: 'サーバー内で予期しないエラーが発生しました',
            },
        };
    }
    // NOTE: うまい方法が思いつかんかった
    switch (error.code) {
        // user
        case 'InvalidUser':
            return {
                status: 400,
                body: error.toJson(),
            };
        case 'MismatchedPassword':
            return {
                status: 401,
                body: error.toJson(),
            };
        case 'UserNotFound':
            return {
                status: 404,
                body: error.toJson(),
            };
        case 'ConflictUser':
            return {
                status: 409,
                body: error.toJson(),
            };
        // token
        case 'InvalidToken':
            return {
                status: 400,
                body: error.toJson(),
            };
        case 'MismatchedToken':
            return {
                status: 401,
                body: error.toJson(),
            };
        case 'TokenRequired':
            return {
                status: 401,
                body: error.toJson(),
            };
        // task
        case 'InvalidTask':
            return {
                status: 400,
                body: error.toJson(),
            };
        case 'TaskNotFound':
            return {
                status: 404,
                body: error.toJson(),
            };
        // default
        case 'ValidateError':
            return {
                status: 400,
                body: error.toJson(),
            };
        case 'UnexpectedError':
            return {
                status: 500,
                body: error.toJson(),
            };
    }
}

const createTasksHandlers = (globalStorage) => {
    return [
        rest.get('/api/tasks', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                const result = await getTasks({
                    state: globalStorage.globalState,
                    input: {
                        user,
                    },
                });
                const tasks = result.output.tasks;
                return res(ctx.status(200), ctx.json(tasks));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
        rest.post('/api/tasks', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskTitle(req.body.title);
                assertValidTaskDetail(req.body.detail);
                const inputTask = {
                    title: req.body.title,
                    detail: req.body.detail,
                };
                const result = await addTask({
                    state: globalStorage.globalState,
                    input: {
                        user: user,
                        task: inputTask,
                    },
                });
                const task = result.output.task;
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200), ctx.json(task));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
const createTasksIdHandlers = (globalStorage) => {
    return [
        rest.get('/api/tasks/:taskId', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskId(req.params.taskId);
                const result = await getTask({
                    state: globalStorage.globalState,
                    input: {
                        user,
                        id: req.params.taskId,
                    },
                });
                const task = result.output.task;
                return res(ctx.status(200), ctx.json(task));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
        rest.patch('/api/tasks/:taskId', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskId(req.params.taskId);
                const incomingPartialTask = {
                    title: req.body.title,
                    detail: req.body.detail,
                };
                assertValidIncomingPartialTask(incomingPartialTask);
                const result = await updateTask({
                    state: globalStorage.globalState,
                    input: {
                        user,
                        id: req.params.taskId,
                        incomingPartialTask,
                    },
                });
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
        rest.delete('/api/tasks/:taskId', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskId(req.params.taskId);
                const result = await deleteTask({
                    state: globalStorage.globalState,
                    input: {
                        user,
                        id: req.params.taskId,
                    },
                });
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
const createTasksIdCompletionHandlers = (globalStorage) => {
    return [
        rest.put('/api/tasks/:taskId/completion', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskId(req.params.taskId);
                const result = await updateTaskCompletion({
                    state: globalStorage.globalState,
                    input: {
                        user,
                        id: req.params.taskId,
                        isComplete: true,
                    },
                });
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
        rest.delete('/api/tasks/:taskId/completion', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    state: globalStorage.globalState,
                    input: {
                        maybeBearerToken: req.headers.get('Authorization'),
                    },
                });
                assertValidTaskId(req.params.taskId);
                const result = await updateTaskCompletion({
                    state: globalStorage.globalState,
                    input: {
                        user,
                        id: req.params.taskId,
                        isComplete: false,
                    },
                });
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
// __________
// combine
function createTaskRestHandlers(globalStorage) {
    return [
        ...createTasksHandlers(globalStorage),
        ...createTasksIdHandlers(globalStorage),
        ...createTasksIdCompletionHandlers(globalStorage),
    ];
}

async function loginUser(props) {
    const { input, state } = props;
    const newState = deepCopyWithWriteable(state);
    const targetUser = state.users.find((u) => u.username === input.username);
    if (!targetUser) {
        throw new UserError(`ユーザー ${input.username} が存在しません`, 'UserNotFound');
    }
    if (targetUser.password !== input.password) {
        throw new UserError(`ユーザー ${input.username} は見つかりましたが、パスワード ${input.password} が正しくありません`, 'MismatchedPassword');
    }
    const token = Base64.encode(JSON.stringify({
        user: input.username,
        date: new Date(),
    }));
    newState.users.forEach((user) => {
        if (user.username === input.username) {
            user.token = token;
        }
    });
    return {
        state: newState,
        outputs: {
            token,
        },
    };
}

async function logoutUser(props) {
    const { state, input } = props;
    const newState = deepCopyWithWriteable(state);
    newState.users.forEach((user) => {
        if (user.id === input.user.id) {
            delete user.token;
        }
    });
    return newState;
}

async function registerUser(props) {
    const { input, state } = props;
    const newState = deepCopyWithWriteable(state);
    if (state.users.filter((u) => u.username === input.username).length > 0) {
        throw new UserError(`ユーザー ${input.username} は既に登録されています`, 'ConflictUser');
    }
    const id = await sha256(input.username);
    newState.users.push({
        username: input.username,
        password: input.password,
        id,
    });
    return newState;
}

const createUsersRegisterHandlers = (globalStorage) => {
    return [
        rest.post('/api/users/register', async (req, res, ctx) => {
            try {
                assertValidUserName(req.body.username);
                assertValidPassword(req.body.password);
                const userInfo = {
                    username: req.body.username,
                    password: req.body.password,
                };
                const result = await registerUser({
                    input: userInfo,
                    state: globalStorage.globalState,
                });
                globalStorage.updateGlobalState(result);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
const createUsersLoginHandlers = (globalStorage) => {
    return [
        rest.post('/api/users/login', async (req, res, ctx) => {
            try {
                assertValidUserName(req.body.username);
                assertValidPassword(req.body.password);
                const userInfo = {
                    username: req.body.username,
                    password: req.body.password,
                };
                const result = await loginUser({
                    input: userInfo,
                    state: globalStorage.globalState,
                });
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200), ctx.json({
                    token: result.outputs.token,
                }));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
const createUsersLogoutHandlers = (globalStorage) => {
    return [
        rest.post('/api/users/logout', async (req, res, ctx) => {
            try {
                const user = await getUserFromToken({
                    input: { maybeBearerToken: req.headers.get('Authorization') },
                    state: globalStorage.globalState,
                });
                const result = await logoutUser({
                    input: { user },
                    state: globalStorage.globalState,
                });
                globalStorage.updateGlobalState(result);
                return res(ctx.status(200));
            }
            catch (error) {
                const response = error2HttpErrorResponse(error);
                return res(ctx.status(response.status), ctx.json(response.body));
            }
        }),
    ];
};
// __________
// combine
function createUserRestHandlers(globalStorage) {
    return [
        ...createUsersRegisterHandlers(globalStorage),
        ...createUsersLoginHandlers(globalStorage),
        ...createUsersLogoutHandlers(globalStorage),
    ];
}

function createRestHandlers(globalStorage) {
    const restHandlers = [
        rest.get('/api/health', (req, res, ctx) => {
            return res(ctx.status(200), ctx.json({ message: "I'm healthy!" }));
        }),
        ...createUserRestHandlers(globalStorage),
        ...createTaskRestHandlers(globalStorage),
    ];
    return restHandlers;
}

const startWorker = (option) => {
    const globalStorage = createGlobalStorage(option);
    const worker = setupWorker(...createRestHandlers(globalStorage));
    worker.start();
};

const createServer = (option) => {
    const globalStorage = createGlobalStorage({
        ...option,
        storeType: 'nothing',
    });
    return setupServer(...createRestHandlers(globalStorage));
};

const restApi = {
    health: {
        get: async () => {
            const res = await fetch('/api/health');
            const body = await res.json();
            return {
                ok: res.ok,
                body,
            };
        },
    },
    users: {
        register: {
            post: async (payload) => {
                const res = await fetch('/api/users/register', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                const body = res.ok ? null : await res.json();
                return {
                    ok: res.ok,
                    body,
                };
            },
        },
        login: {
            post: async (payload) => {
                const res = await fetch('/api/users/login', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
                const body = await res.json();
                return {
                    ok: res.ok,
                    body,
                };
            },
        },
        logout: {
            post: async (token) => {
                const res = await fetch('/api/users/logout', {
                    method: 'post',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const body = res.ok ? null : await res.json();
                return {
                    ok: res.ok,
                    body,
                };
            },
        },
    },
    tasks: {
        get: async (token) => {
            const res = await fetch('/api/tasks', {
                method: 'get',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const body = await res.json();
            return {
                ok: res.ok,
                body,
            };
        },
        post: async (payload, token) => {
            const res = await fetch('/api/tasks', {
                method: 'post',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            return {
                ok: res.ok,
                body,
            };
        },
        _taskId: (taskId) => {
            return {
                get: async (token) => {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'get',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    const body = await res.json();
                    return {
                        ok: res.ok,
                        body,
                    };
                },
                patch: async (payload, token) => {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'patch',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload),
                    });
                    const body = res.ok ? null : await res.json();
                    return {
                        ok: res.ok,
                        body,
                    };
                },
                delete: async (token) => {
                    const res = await fetch(`/api/tasks/${taskId}`, {
                        method: 'delete',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    const body = res.ok ? null : await res.json();
                    return {
                        ok: res.ok,
                        body,
                    };
                },
                completion: {
                    put: async (token) => {
                        const res = await fetch(`/api/tasks/${taskId}/completion`, {
                            method: 'put',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });
                        const body = res.ok ? null : await res.json();
                        return {
                            ok: res.ok,
                            body,
                        };
                    },
                    delete: async (token) => {
                        const res = await fetch(`/api/tasks/${taskId}/completion`, {
                            method: 'delete',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });
                        const body = res.ok ? null : await res.json();
                        return {
                            ok: res.ok,
                            body,
                        };
                    },
                },
            };
        },
    },
};

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    restApi: restApi
});

export { index as client, createServer, startWorker };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwic291cmNlcyI6WyIuLi9zcmMvc3RvcmUvbG9jYWxTdG9yYWdlLnRzIiwiLi4vc3JjL3V0aWxzL2RlZXBDb3B5LnRzIiwiLi4vc3JjL3V0aWxzL2N1c3RvbUVycm9yLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdG9rZW4vZXJyb3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90b2tlbi92YWxpZGF0b3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90b2tlbi9nZXRVc2VyRnJvbVRva2VuLnRzIiwiLi4vc3JjL3V0aWxzL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvZXJyb3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy91c2VyL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0YXRlLnRzIiwiLi4vc3JjL2NvcmUvZ2xvYmFsU3RhdGUvZ2xvYmFsU3RvcmFnZS50cyIsIi4uL3NyYy91dGlscy9zaGEyNTYudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL2FkZFRhc2sudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL2Vycm9yLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdGFzay9kZWxldGVUYXNrLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdGFzay9nZXRUYXNrcy50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svZ2V0VGFzay50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svdXBkYXRlVGFzay50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svdXBkYXRlVGFza0NvbXBsZXRpb24udHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9oYW5kbGVycy9yZXN0L2Vycm9yLnRzIiwiLi4vc3JjL2hhbmRsZXJzL3Jlc3QvdGFza1Jlc3RIYW5kbGVycy50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvbG9naW4udHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy91c2VyL2xvZ291dC50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvcmVnaXN0ZXIudHMiLCIuLi9zcmMvaGFuZGxlcnMvcmVzdC91c2VyUmVzdEhhbmRsZXJzLnRzIiwiLi4vc3JjL2hhbmRsZXJzL3Jlc3QvcmVzdEhhbmRsZXJzLnRzIiwiLi4vc3JjL3dvcmtlci50cyIsIi4uL3NyYy9zZXJ2ZXIudHMiLCIuLi9zcmMvY2xpZW50L3Jlc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuL3R5cGVzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwTG9jYWxTdG9yYWdlPFQgZXh0ZW5kcyBvYmplY3Q+KCk6IFN0b3JlPFQ+IHtcbiAgY29uc3QgTE9DQUxfU1RPUkFHRV9LRVkgPSAnVE9ET19NT0NLX0FQSV9TVE9SQUdFX0tFWSc7XG5cbiAgY29uc3Qgc3RvcmU6IFN0b3JlPFQ+ID0ge1xuICAgIGdldERhdGE6ICgpID0+IHtcbiAgICAgIGNvbnN0IGRhdGEgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShMT0NBTF9TVE9SQUdFX0tFWSk7XG4gICAgICByZXR1cm4gZGF0YSAmJiBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH0sXG5cbiAgICBzZXREYXRhOiAoc3RhdGUpID0+IHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExPQ0FMX1NUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeShzdGF0ZSkpO1xuICAgIH0sXG4gIH07XG5cbiAgcmV0dXJuIHN0b3JlO1xufVxuIiwiaW1wb3J0IHsgRGVlcFdyaXRlYWJsZSB9IGZyb20gJy4vdHlwZXMnO1xuXG4vKipcbiAqIOOCquODluOCuOOCp+OCr+ODiOOCkuODh+OCo+ODvOODl+OCs+ODlOODvOOBl+OBpiByZWFkb25seSDjgpLop6PpmaTjgZnjgotcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZXBDb3B5V2l0aFdyaXRlYWJsZTxUIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4+KFxuICBvYmplY3Q6IFRcbik6IERlZXBXcml0ZWFibGU8VD4ge1xuICAvLyBOb3RlOiDjg4fjgqPjg7zjg5fjgrPjg5Tjg7zjgZfjgZ/ntZDmnpzjga/jgYTjgZjjgaPjgabjgoLllY/poYzjgarjgYTjga7jgacgcmVhZG9ubHkg44KS5raI44GZXG4gIC8vIOa2iOOBl+OBn+OBj+OBquOBhOOBruOBp+OBguOCjOOBsCBzdHJ1Y3R1cmVkQ2xvbmUg44KS44Gd44Gu44G+44G+5L2/44Gj44Gm44GP44KMXG4gIHJldHVybiBzdHJ1Y3R1cmVkQ2xvbmUob2JqZWN0KSBhcyB1bmtub3duIGFzIERlZXBXcml0ZWFibGU8VD47XG59XG4iLCJleHBvcnQgdHlwZSBDb21tb25FcnJvckNvZGUgPSAnVmFsaWRhdGVFcnJvcicgfCAnVW5leHBlY3RlZEVycm9yJztcblxuLyoqXG4gKiDjgqjjg6njg7zjgq/jg6njgrlcbiAqL1xuZXhwb3J0IGNsYXNzIEN1c3RvbUVycm9yPFQgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmc+IGV4dGVuZHMgRXJyb3Ige1xuICBjb2RlOiBUIHwgQ29tbW9uRXJyb3JDb2RlO1xuXG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgY29kZTogVCB8IENvbW1vbkVycm9yQ29kZSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIC8vIOmWi+eZuuiAheeUqOOBruOCqOODqeODvOODoeODg+OCu+ODvOOCuFxuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgLy8g44Ki44OX44Oq44Gu44Ko44Op44O844Kz44O844OJXG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgfVxuXG4gIHRvSnNvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY29kZTogdGhpcy5jb2RlLFxuICAgICAgbWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuICAgIH07XG4gIH1cbn1cbiIsImltcG9ydCB7IEN1c3RvbUVycm9yIH0gZnJvbSAnfi91dGlscy9jdXN0b21FcnJvcic7XG5cbmV4cG9ydCB0eXBlIFRva2VuRXJyb3JDb2RlID1cbiAgfCAnSW52YWxpZFRva2VuJ1xuICB8ICdNaXNtYXRjaGVkVG9rZW4nXG4gIHwgJ1Rva2VuUmVxdWlyZWQnO1xuXG5leHBvcnQgY2xhc3MgVG9rZW5FcnJvciBleHRlbmRzIEN1c3RvbUVycm9yPFRva2VuRXJyb3JDb2RlPiB7fVxuXCIuLi8uLi8uLi91dGlscy9jdXN0b21FcnJvclwiIiwiaW1wb3J0IHsgVG9rZW5FcnJvciB9IGZyb20gJy4vZXJyb3InO1xuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRUb2tlbihcbiAgdG9rZW46IHVua25vd25cbik6IGFzc2VydHMgdG9rZW4gaXMgc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHRva2VuID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuICBpZiAodHlwZW9mIHRva2VuICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUb2tlbkVycm9yKCfjg4jjg7zjgq/jg7PjgYzmloflrZfliJfjgafjga/jgYLjgorjgb7jgZvjgpMnLCAnSW52YWxpZFRva2VuJyk7XG4gIH1cblxuICBpZiAoIS9eWzAtOWEtekEtWi0uX34rL10rPSokLy50ZXN0KHRva2VuKSkge1xuICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgJ+ODiOODvOOCr+ODs+OBryB0b2tlbjY4IOOBruW9ouW8j+OBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmScsXG4gICAgICAnSW52YWxpZFRva2VuJ1xuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrQW5kR2V0QmVhcmVyVG9rZW4odmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgJ2JlYXJlciB0b2tlbiDjgYzmloflrZfliJfjgafjga/jgYLjgorjgb7jgZvjgpPjgILoqK3lrprjgZXjgozjgabjgYTjgarjgYTlj6/og73mgKfjgYzjgYLjgorjgb7jgZnjgIInLFxuICAgICAgJ0ludmFsaWRUb2tlbidcbiAgICApO1xuICB9XG5cbiAgY29uc3QgcmVnZXhCZWFyZXJUb2tlbiA9IC9CZWFyZXJcXHMrKD88dG9rZW4+XFxTKikvO1xuICBjb25zdCBtYXRjaGVkVG9rZW4gPSB2YWx1ZS5tYXRjaChyZWdleEJlYXJlclRva2VuKTtcbiAgY29uc3QgdG9rZW4gPSBtYXRjaGVkVG9rZW4/Lmdyb3Vwcz8udG9rZW47XG5cbiAgaWYgKCF0b2tlbikge1xuICAgIHRocm93IG5ldyBUb2tlbkVycm9yKCd0b2tlbiDjgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ/jgIInLCAnSW52YWxpZFRva2VuJyk7XG4gIH1cbiAgYXNzZXJ0VmFsaWRUb2tlbih0b2tlbik7XG5cbiAgcmV0dXJuIHRva2VuO1xufVxuIiwiaW1wb3J0IHsgZGVlcENvcHlXaXRoV3JpdGVhYmxlIH0gZnJvbSAnfi91dGlscy9kZWVwQ29weSc7XG5cbmltcG9ydCB7IFRva2VuRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcbmltcG9ydCB7IGNoZWNrQW5kR2V0QmVhcmVyVG9rZW4gfSBmcm9tICcuL3ZhbGlkYXRvcic7XG5cbmltcG9ydCB0eXBlIHsgVXNlclN0YXRlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG5pbnRlcmZhY2UgR2V0VXNlckZyb21Ub2tlbklucHV0IHtcbiAgbWF5YmVCZWFyZXJUb2tlbjogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFVzZXJGcm9tVG9rZW4oXG4gIHByb3BzOiBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQ8R2V0VXNlckZyb21Ub2tlbklucHV0PlxuKTogUHJvbWlzZTxVc2VyU3RhdGU+IHtcbiAgY29uc3QgeyBpbnB1dCwgc3RhdGUgfSA9IHByb3BzO1xuICBjb25zdCBjbG9uZVN0YXRlID0gZGVlcENvcHlXaXRoV3JpdGVhYmxlKHN0YXRlKTtcblxuICBpZiAoaW5wdXQubWF5YmVCZWFyZXJUb2tlbiA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUb2tlbkVycm9yKFxuICAgICAgJ+ODquOCueOCqOOCueODiOODmOODg+ODgOOBqyBBdXRob3JpemF0aW9uIOOBjOWtmOWcqOOBl+OBvuOBm+OCkycsXG4gICAgICAnVG9rZW5SZXF1aXJlZCdcbiAgICApO1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBjaGVja0FuZEdldEJlYXJlclRva2VuKGlucHV0Lm1heWJlQmVhcmVyVG9rZW4pO1xuXG4gIGNvbnN0IHVzZXIgPSBjbG9uZVN0YXRlLnVzZXJzLmZpbmQoKHUpID0+IHUudG9rZW4gPT09IHRva2VuKTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAn44OI44O844Kv44Oz44Gu5YCk44Gr6Kmy5b2T44GZ44KL44Om44O844K244O844GM6KaL44Gk44GL44KK44G+44Gb44KT44Gn44GX44GfJyxcbiAgICAgICdNaXNtYXRjaGVkVG9rZW4nXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB1c2VyO1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi91c2VyXCJcIi4uLy4uL3R5cGVzXCIiLCJpbXBvcnQgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnLi90eXBlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Vua25vd25SZWNvcmQodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBVbmtub3duUmVjb3JkIHtcbiAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCc7XG59XG4iLCJpbXBvcnQgeyBDdXN0b21FcnJvciB9IGZyb20gJ34vdXRpbHMvY3VzdG9tRXJyb3InO1xuXG5leHBvcnQgdHlwZSBVc2VyRXJyb3JDb2RlID1cbiAgfCAnQ29uZmxpY3RVc2VyJ1xuICB8ICdJbnZhbGlkVXNlcidcbiAgfCAnTWlzbWF0Y2hlZFBhc3N3b3JkJ1xuICB8ICdVc2VyTm90Rm91bmQnO1xuXG5leHBvcnQgY2xhc3MgVXNlckVycm9yIGV4dGVuZHMgQ3VzdG9tRXJyb3I8VXNlckVycm9yQ29kZT4ge31cblwiLi4vLi4vLi4vdXRpbHMvY3VzdG9tRXJyb3JcIiIsImltcG9ydCB7IGFzc2VydFZhbGlkVG9rZW4gfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdG9rZW4nO1xuaW1wb3J0IHsgaXNVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy92YWxpZGF0b3InO1xuXG5pbXBvcnQgeyBVc2VyRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBVc2VyU3RhdGUsIFVzZXIgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgVW5rbm93blJlY29yZCB9IGZyb20gJ34vdXRpbHMvdHlwZXMnO1xuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRVc2VyTmFtZShcbiAgdXNlcm5hbWU6IHVua25vd25cbik6IGFzc2VydHMgdXNlcm5hbWUgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiB1c2VybmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKCfjg6bjg7zjgrbjg7zlkI3jgYzmloflrZfliJfjgafjga/jgYLjgorjgb7jgZvjgpMnLCAnSW52YWxpZFVzZXInKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRQYXNzd29yZChcbiAgcGFzc3dvcmQ6IHVua25vd25cbik6IGFzc2VydHMgcGFzc3dvcmQgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBwYXNzd29yZCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKCfjg5Hjgrnjg6/jg7zjg4njgYzmloflrZfliJfjgafjga/jgYLjgorjgb7jgZvjgpMnLCAnSW52YWxpZFVzZXInKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRVc2VySWQoXG4gIG1heWJlVXNlcklkOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlVXNlcklkIGlzIHN0cmluZyB7XG4gIGlmICh0eXBlb2YgbWF5YmVVc2VySWQgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFVzZXJFcnJvcign44Om44O844K244O8IElEIOOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVXNlcicpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFVzZXIoc3RhdGU6IHVua25vd24pOiBhc3NlcnRzIHN0YXRlIGlzIFVzZXIge1xuICBpZiAoIWlzVW5rbm93blJlY29yZChzdGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKCfjg6bjg7zjgrbjg7zjga7lgKTjgYznhKHlirnjgafjgZknLCAnSW52YWxpZFVzZXInKTtcbiAgfVxuXG4gIGFzc2VydFZhbGlkVXNlck5hbWUoc3RhdGUudXNlcm5hbWUpO1xuICBhc3NlcnRWYWxpZFBhc3N3b3JkKHN0YXRlLnBhc3N3b3JkKTtcbiAgYXNzZXJ0VmFsaWRUb2tlbihzdGF0ZS50b2tlbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFVzZXJTdGF0ZShcbiAgc3RhdGU6IHVua25vd25cbik6IGFzc2VydHMgc3RhdGUgaXMgVXNlclN0YXRlIHtcbiAgYXNzZXJ0VmFsaWRVc2VyKHN0YXRlKTtcbiAgYXNzZXJ0VmFsaWRVc2VySWQoKHN0YXRlIGFzIHVua25vd24gYXMgVW5rbm93blJlY29yZCkuaWQpO1xufVxuXCIuLi90b2tlblwiXCIuLi8uLi8uLi91dGlscy92YWxpZGF0b3JcIlwiLi4vLi4vLi4vdXRpbHMvdHlwZXNcIiIsImltcG9ydCB7IGFzc2VydFZhbGlkVXNlclN0YXRlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXIvdmFsaWRhdG9yJztcblxuaW1wb3J0IHR5cGUgeyBUYXNrU3RhdGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdGFzayc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgVW5rbm93blJlY29yZCB9IGZyb20gJ34vdXRpbHMvdHlwZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdsb2JhbFN0YXRlIHtcbiAgdXNlcnM6IFVzZXJTdGF0ZVtdO1xuICB0YXNrczogVGFza1N0YXRlW107XG59XG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0R2xvYmFsU3RhdGU6IEdsb2JhbFN0YXRlID0ge1xuICB1c2VyczogW1xuICAgIHtcbiAgICAgIHVzZXJuYW1lOiAnZ3Vlc3QnLFxuICAgICAgcGFzc3dvcmQ6ICdwYXNzd29yZCcsXG4gICAgICBpZDogJ0dVRVNUX0lEJyxcbiAgICB9LFxuICBdLFxuICB0YXNrczogW10sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZEdsb2JhbFN0YXRlKHN0YXRlOiBVbmtub3duUmVjb3JkIHwgbnVsbCk6IGJvb2xlYW4ge1xuICBpZiAoIXN0YXRlKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2Ygc3RhdGUgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gIGlmICghQXJyYXkuaXNBcnJheShzdGF0ZS51c2VycykpIHJldHVybiBmYWxzZTtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHN0YXRlLnRhc2tzKSkgcmV0dXJuIGZhbHNlO1xuXG4gIHRyeSB7XG4gICAgZm9yIChjb25zdCB1c2VyIG9mIHN0YXRlLnVzZXJzKSB7XG4gICAgICBhc3NlcnRWYWxpZFVzZXJTdGF0ZSh1c2VyKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cIi4uL2ZlYXR1cmVzL3VzZXIvdmFsaWRhdG9yXCJcIi4uL2ZlYXR1cmVzL3Rhc2tcIlwiLi4vZmVhdHVyZXMvdXNlclwiXCIuLi8uLi91dGlscy90eXBlc1wiIiwiaW1wb3J0IHsgc2V0dXBMb2NhbFN0b3JhZ2UgfSBmcm9tICd+L3N0b3JlL2xvY2FsU3RvcmFnZSc7XG5cbmltcG9ydCB7XG4gIHR5cGUgR2xvYmFsU3RhdGUsXG4gIGRlZmF1bHRHbG9iYWxTdGF0ZSxcbiAgaXNWYWxpZEdsb2JhbFN0YXRlLFxufSBmcm9tICcuL2dsb2JhbFN0YXRlJztcblxuaW1wb3J0IHR5cGUgeyBTdG9yZSB9IGZyb20gJ34vc3RvcmUvdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYmFsU3RvcmVPcHRpb24ge1xuICAvKipcbiAgICog44OH44O844K/44Gu5Yid5pyf5YCk44CCXG4gICAqL1xuICBpbml0aWFsU3RhdGU/OiBHbG9iYWxTdGF0ZTtcbiAgLyoqXG4gICAqIOODh+ODvOOCv+OCkuS/neaMgeOBmeOCi+aWueazleOAglxuICAgKiDjgarjgavjgoLpgbjmip7jgZfjgarjgYvjgaPjgZ/loLTlkIjjga8gJ2xvY2FsU3RvcmFnZScg44Gr44Gq44KL44CCXG4gICAqL1xuICBzdG9yZVR5cGU/OiAnbG9jYWxTdG9yYWdlJyB8ICdub3RoaW5nJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHbG9iYWxTdG9yYWdlIHtcbiAgZ2xvYmFsU3RhdGU6IEdsb2JhbFN0YXRlO1xuICB1cGRhdGVHbG9iYWxTdGF0ZTogKHN0YXRlOiBHbG9iYWxTdGF0ZSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFN0b3JhZ2Uob3B0aW9uPzogR2xvYmFsU3RvcmVPcHRpb24pOiBHbG9iYWxTdG9yYWdlIHtcbiAgY29uc3Qgc3RvcmUgPSBpbml0U3RvcmUob3B0aW9uKTtcbiAgbGV0IGdsb2JhbFN0YXRlID0gc3RvcmUuZ2V0RGF0YSgpIGFzIHVua25vd24gYXMgR2xvYmFsU3RhdGU7XG5cbiAgY29uc3QgdXBkYXRlR2xvYmFsU3RhdGUgPSAoc3RhdGU6IEdsb2JhbFN0YXRlKSA9PiB7XG4gICAgc3RvcmUuc2V0RGF0YShzdGF0ZSk7XG4gICAgZ2xvYmFsU3RhdGUgPSBzdGF0ZTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGdldCBnbG9iYWxTdGF0ZSgpIHtcbiAgICAgIHJldHVybiBnbG9iYWxTdGF0ZTtcbiAgICB9LFxuICAgIHVwZGF0ZUdsb2JhbFN0YXRlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbml0U3RvcmUob3B0aW9uPzogR2xvYmFsU3RvcmVPcHRpb24pOiBTdG9yZTxHbG9iYWxTdGF0ZT4ge1xuICBpZiAob3B0aW9uPy5zdG9yZVR5cGUgPT09ICdub3RoaW5nJykge1xuICAgIHJldHVybiB7XG4gICAgICBnZXREYXRhOiAoKSA9PiB7XG4gICAgICAgIHJldHVybiBvcHRpb24/LmluaXRpYWxTdGF0ZSB8fCBkZWZhdWx0R2xvYmFsU3RhdGU7XG4gICAgICB9LFxuICAgICAgc2V0RGF0YTogKCkgPT4ge1xuICAgICAgICAvLyBkb24ndCBhbnl0aGluZ1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8g44GT44Gu5pmC54K544Gn44GvIEdsb2JhbFN0YXRlIOOBr+eiuuWumuOBl+OBpuOBhOOBquOBhFxuICBjb25zdCBzdG9yZSA9IHNldHVwTG9jYWxTdG9yYWdlPEdsb2JhbFN0YXRlPigpO1xuXG4gIHRyeSB7XG4gICAgaWYgKG9wdGlvbj8uaW5pdGlhbFN0YXRlKSB7XG4gICAgICBzdG9yZS5zZXREYXRhKG9wdGlvbi5pbml0aWFsU3RhdGUpO1xuICAgIH1cbiAgICBpZiAoIXN0b3JlLmdldERhdGEoKSkge1xuICAgICAgc3RvcmUuc2V0RGF0YShkZWZhdWx0R2xvYmFsU3RhdGUpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAn5L+d5a2Y44GV44KM44Gm44GE44KL44OH44O844K/44GM5q2j44GX44GE5b2i5byP44Gn44Gv44GC44KK44G+44Gb44KTLiDjg4fjg7zjgr/jgpLliYrpmaTjgZnjgovjgYvjgIHmraPjgZfjgYTlvaLlvI/jgavkv67mraPjgZfjgabjgY/jgaDjgZXjgYQuJ1xuICAgICk7XG4gIH1cblxuICBpZiAoIWlzVmFsaWRHbG9iYWxTdGF0ZShzdG9yZS5nZXREYXRhKCkgYXMgVW5rbm93blJlY29yZCB8IG51bGwpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ+S/neWtmOOBleOCjOOBpuOBhOOCi+ODh+ODvOOCv+OBjOato+OBl+OBhOW9ouW8j+OBp+OBr+OBguOCiuOBvuOBm+OCky4g44OH44O844K/44KS5YmK6Zmk44GZ44KL44GL44CB5q2j44GX44GE5b2i5byP44Gr5L+u5q2j44GX44Gm44GP44Gg44GV44GELidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHN0b3JlO1xufVxuXCIuLi8uLi9zdG9yZS9sb2NhbFN0b3JhZ2VcIlwiLi4vLi4vc3RvcmUvdHlwZXNcIlwiLi4vLi4vdXRpbHMvdHlwZXNcIiIsImV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaGEyNTYodGV4dDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgdWludDggPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodGV4dCk7XG4gIGNvbnN0IGRpZ2VzdCA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KCdTSEEtMjU2JywgdWludDgpO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG5ldyBVaW50OEFycmF5KGRpZ2VzdCkpXG4gICAgLm1hcCgodikgPT4gdi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSlcbiAgICAuam9pbignJyk7XG59XG4iLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcbmltcG9ydCB7IHNoYTI1NiB9IGZyb20gJ34vdXRpbHMvc2hhMjU2JztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG50eXBlIElucHV0VGFzayA9IE9taXQ8VGFzaywgJ2lkJyB8ICdjcmVhdGVkX2F0JyB8ICdpc19jb21wbGV0ZSc+O1xuXG5pbnRlcmZhY2UgQWRkVGFza0lucHV0IHtcbiAgdGFzazogSW5wdXRUYXNrO1xuICB1c2VyOiBVc2VyU3RhdGU7XG59XG5cbmludGVyZmFjZSBBZGRUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxBZGRUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPEFkZFRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgY3JlYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICBjb25zdCBpZCA9IGF3YWl0IHNoYTI1NihgJHtpbnB1dC51c2VyfToke2NyZWF0ZWRBdH1gKTtcbiAgY29uc3QgdGFzazogVGFzayA9IHtcbiAgICAuLi5pbnB1dC50YXNrLFxuICAgIGlkLFxuICAgIGlzX2NvbXBsZXRlOiBmYWxzZSxcbiAgICBjcmVhdGVkX2F0OiBjcmVhdGVkQXQsXG4gIH07XG5cbiAgbmV3U3RhdGUudGFza3MucHVzaCh7XG4gICAgLi4udGFzayxcbiAgICB1c2VySWQ6IGlucHV0LnVzZXIuaWQsXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICAgIG91dHB1dDoge1xuICAgICAgdGFzazogdGFzayxcbiAgICB9LFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi8uLi8uLi91dGlscy9zaGEyNTZcIlwiLi4vdXNlclwiXCIuLi8uLi9nbG9iYWxTdGF0ZVwiXCIuLi8uLi90eXBlc1wiIiwiaW1wb3J0IHsgQ3VzdG9tRXJyb3IgfSBmcm9tICd+L3V0aWxzL2N1c3RvbUVycm9yJztcblxuZXhwb3J0IHR5cGUgVGFza0Vycm9yQ29kZSA9ICdJbnZhbGlkVGFzaycgfCAnVGFza05vdEZvdW5kJztcblxuZXhwb3J0IGNsYXNzIFRhc2tFcnJvciBleHRlbmRzIEN1c3RvbUVycm9yPFRhc2tFcnJvckNvZGU+IHt9XG5cIi4uLy4uLy4uL3V0aWxzL2N1c3RvbUVycm9yXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVXNlclN0YXRlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdGF0ZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZSc7XG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJ34vY29yZS90eXBlcyc7XG5cbmludGVyZmFjZSBEZWxldGVUYXNrSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBEZWxldGVUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxEZWxldGVUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPERlbGV0ZVRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcblxuICBpZiAoIXRhc2tTdGF0ZSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoYOWvvuixoeOBruOCv+OCueOCr+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn2AsICdUYXNrTm90Rm91bmQnKTtcbiAgfVxuXG4gIG5ld1N0YXRlLnRhc2tzID0gbmV3U3RhdGUudGFza3MuZmlsdGVyKFxuICAgICh0KSA9PiAhKHQudXNlcklkID09PSBpbnB1dC51c2VyLmlkICYmIHQuaWQgPT09IGlucHV0LmlkKVxuICApO1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi91c2VyXCJcIi4uLy4uL2dsb2JhbFN0YXRlXCJcIi4uLy4uL3R5cGVzXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIEdldFRhc2tzSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG59XG5cbmludGVyZmFjZSBHZXRUYXNrc1JldHVybiB7XG4gIG91dHB1dDoge1xuICAgIHRhc2tzOiBUYXNrW107XG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYXNrcyhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxHZXRUYXNrc0lucHV0PlxuKTogUHJvbWlzZTxHZXRUYXNrc1JldHVybj4ge1xuICBjb25zdCB7IHN0YXRlLCBpbnB1dCB9ID0gcHJvcHM7XG4gIGNvbnN0IG5ld1N0YXRlID0gZGVlcENvcHlXaXRoV3JpdGVhYmxlKHN0YXRlKTtcblxuICBjb25zdCB0YXNrc1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmlsdGVyKCh0KSA9PiB0LnVzZXJJZCA9PT0gaW5wdXQudXNlci5pZCk7XG5cbiAgY29uc3QgdGFza3M6IFRhc2tbXSA9IHRhc2tzU3RhdGUubWFwKCh0KSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB0LmlkLFxuICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICBkZXRhaWw6IHQuZGV0YWlsLFxuICAgICAgaXNfY29tcGxldGU6IHQuaXNfY29tcGxldGUsXG4gICAgICBjcmVhdGVkX2F0OiB0LmNyZWF0ZWRfYXQsXG4gICAgfTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHRhc2tzLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgeyBUYXNrRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIEdldFRhc2tJbnB1dCB7XG4gIHVzZXI6IFVzZXJTdGF0ZTtcbiAgaWQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEdldFRhc2tSZXR1cm4ge1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxHZXRUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPEdldFRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcblxuICBpZiAoIXRhc2tTdGF0ZSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoYOWvvuixoeOBruOCv+OCueOCr+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn2AsICdUYXNrTm90Rm91bmQnKTtcbiAgfVxuXG4gIGNvbnN0IHRhc2s6IFRhc2sgPSB7XG4gICAgaWQ6IHRhc2tTdGF0ZS5pZCxcbiAgICB0aXRsZTogdGFza1N0YXRlLnRpdGxlLFxuICAgIGRldGFpbDogdGFza1N0YXRlLmRldGFpbCxcbiAgICBpc19jb21wbGV0ZTogdGFza1N0YXRlLmlzX2NvbXBsZXRlLFxuICAgIGNyZWF0ZWRfYXQ6IHRhc2tTdGF0ZS5jcmVhdGVkX2F0LFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgb3V0cHV0OiB7XG4gICAgICB0YXNrLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgeyBUYXNrRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG5jb25zdCBjaGFuZ2VhYmxlVGFza1BhcmFtS2V5ID0gWyd0aXRsZScsICdkZXRhaWwnXSBhcyBjb25zdDtcbnR5cGUgQ2hhbmdlYWJsZVRhc2tQYXJhbUtleSA9IHR5cGVvZiBjaGFuZ2VhYmxlVGFza1BhcmFtS2V5W251bWJlcl07XG4vLyBOT1RFOiDlpInmm7TjgZnjgovjgajjgY3jga8gdmFsaWRhdG9yIOOCguODgeOCp+ODg+OCr+OBl+OBpuOBrVxuZXhwb3J0IHR5cGUgSW5jb21pbmdQYXJ0aWFsVGFzayA9IFBhcnRpYWw8UGljazxUYXNrLCBDaGFuZ2VhYmxlVGFza1BhcmFtS2V5Pj47XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG4gIGluY29taW5nUGFydGlhbFRhc2s6IEluY29taW5nUGFydGlhbFRhc2s7XG59XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxVcGRhdGVUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPFVwZGF0ZVRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcbiAgaWYgKCF0YXNrU3RhdGUpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKGDlr77osaHjga7jgr/jgrnjgq/jgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ9gLCAnVGFza05vdEZvdW5kJyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGsgb2YgY2hhbmdlYWJsZVRhc2tQYXJhbUtleSkge1xuICAgIGNvbnN0IHYgPSBpbnB1dC5pbmNvbWluZ1BhcnRpYWxUYXNrW2tdO1xuICAgIC8vIE5PVEU6IGRldGFpbCDjga8gdW5kZWZpbmVkIOWPr+OBquOBruOBp+W8vuOBhOOBpuOBhOOBhOOBruOBiy4uLlxuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhc2tTdGF0ZVtrXSA9IHY7XG4gICAgfVxuICB9XG4gIGNvbnN0IHRhc2s6IFRhc2sgPSB7XG4gICAgaWQ6IHRhc2tTdGF0ZS5pZCxcbiAgICB0aXRsZTogdGFza1N0YXRlLnRpdGxlLFxuICAgIGRldGFpbDogdGFza1N0YXRlLmRldGFpbCxcbiAgICBpc19jb21wbGV0ZTogdGFza1N0YXRlLmlzX2NvbXBsZXRlLFxuICAgIGNyZWF0ZWRfYXQ6IHRhc2tTdGF0ZS5jcmVhdGVkX2F0LFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICAgIG91dHB1dDoge1xuICAgICAgdGFzayxcbiAgICB9LFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi91c2VyXCJcIi4uLy4uL2dsb2JhbFN0YXRlXCJcIi4uLy4uL3R5cGVzXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFzayB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBVc2VyU3RhdGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdXNlcic7XG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0YXRlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIFVwZGF0ZVRhc2tDb21wbGV0aW9uSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG4gIGlzQ29tcGxldGU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrQ29tcGxldGlvblJldHVybiB7XG4gIHN0YXRlOiBHbG9iYWxTdGF0ZTtcbiAgb3V0cHV0OiB7XG4gICAgdGFzazogVGFzaztcbiAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVRhc2tDb21wbGV0aW9uKFxuICBwcm9wczogV2l0aERCU3RhdGVSZWFkb25seUlucHV0PFVwZGF0ZVRhc2tDb21wbGV0aW9uSW5wdXQ+XG4pOiBQcm9taXNlPFVwZGF0ZVRhc2tDb21wbGV0aW9uUmV0dXJuPiB7XG4gIGNvbnN0IHsgc3RhdGUsIGlucHV0IH0gPSBwcm9wcztcbiAgY29uc3QgbmV3U3RhdGUgPSBkZWVwQ29weVdpdGhXcml0ZWFibGUoc3RhdGUpO1xuXG4gIGNvbnN0IHRhc2tTdGF0ZSA9IG5ld1N0YXRlLnRhc2tzLmZpbmQoXG4gICAgKHQpID0+IHQudXNlcklkID09PSBpbnB1dC51c2VyLmlkICYmIHQuaWQgPT09IGlucHV0LmlkXG4gICk7XG5cbiAgaWYgKCF0YXNrU3RhdGUpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKGDlr77osaHjga7jgr/jgrnjgq/jgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ9gLCAnVGFza05vdEZvdW5kJyk7XG4gIH1cblxuICB0YXNrU3RhdGUuaXNfY29tcGxldGUgPSBpbnB1dC5pc0NvbXBsZXRlO1xuICBjb25zdCB0YXNrOiBUYXNrID0ge1xuICAgIGlkOiB0YXNrU3RhdGUuaWQsXG4gICAgdGl0bGU6IHRhc2tTdGF0ZS50aXRsZSxcbiAgICBkZXRhaWw6IHRhc2tTdGF0ZS5kZXRhaWwsXG4gICAgaXNfY29tcGxldGU6IGlucHV0LmlzQ29tcGxldGUsXG4gICAgY3JlYXRlZF9hdDogdGFza1N0YXRlLmNyZWF0ZWRfYXQsXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBzdGF0ZTogbmV3U3RhdGUsXG4gICAgb3V0cHV0OiB7XG4gICAgICB0YXNrLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vZ2xvYmFsU3RhdGVcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGlzVW5rbm93blJlY29yZCB9IGZyb20gJ34vdXRpbHMvdmFsaWRhdG9yJztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFzaywgVGFza1N0YXRlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEluY29taW5nUGFydGlhbFRhc2sgfSBmcm9tICcuL3VwZGF0ZVRhc2snO1xuaW1wb3J0IHR5cGUgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy90eXBlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tJZChcbiAgbWF5YmVUYXNrSWQ6IHVua25vd25cbik6IGFzc2VydHMgbWF5YmVUYXNrSWQgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tJZCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKCfjgr/jgrnjgq8gSUQg44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJywgJ0ludmFsaWRUYXNrJyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza1RpdGxlKFxuICBtYXliZVRhc2tUaXRsZTogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tUaXRsZSBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIG1heWJlVGFza1RpdGxlICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+OCv+OCpOODiOODq+OBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tEZXRhaWwoXG4gIG1heWJlVGFza0RldGFpbDogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tEZXRhaWwgaXMgc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKG1heWJlVGFza0RldGFpbCA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tEZXRhaWwgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRhc2tFcnJvcign44K/44K544Kv6Kmz57Sw44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJywgJ0ludmFsaWRUYXNrJyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza0lzQ29tcGxldGUoXG4gIG1heWJlVGFza0lzQ29tcGxldGU6IHVua25vd25cbik6IGFzc2VydHMgbWF5YmVUYXNrSXNDb21wbGV0ZSBpcyBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tJc0NvbXBsZXRlICE9PSAnYm9vbGVhbicpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKFxuICAgICAgJ+OCv+OCueOCr+WujOS6huODleODqeOCsOOBjOecn+WBveWApOOBp+OBr+OBguOCiuOBvuOBm+OCkycsXG4gICAgICAnSW52YWxpZFRhc2snXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRUYXNrQ3JlYXRlZEF0KFxuICBtYXliZVRhc2tJc0NyZWF0ZWRBdDogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tJc0NyZWF0ZWRBdCBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIG1heWJlVGFza0lzQ3JlYXRlZEF0ICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+S9nOaIkOaXpeaZguOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG5cbiAgaWYgKGlzTmFOKERhdGUucGFyc2UobWF5YmVUYXNrSXNDcmVhdGVkQXQpKSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoXG4gICAgICAn44K/44K544Kv5L2c5oiQ5pel5pmC44GM5pel5LuY44Gu44OV44Kp44O844Oe44OD44OI44Gn44Gv44GC44KK44G+44Gb44KTJyxcbiAgICAgICdJbnZhbGlkVGFzaydcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tVc2VySWQoXG4gIG1heWJlVGFza0lzVXNlcklkOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlVGFza0lzVXNlcklkIGlzIHN0cmluZyB7XG4gIGlmICh0eXBlb2YgbWF5YmVUYXNrSXNVc2VySWQgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRhc2tFcnJvcihcbiAgICAgICfjgr/jgrnjgq/jga7jg6bjg7zjgrbjg7wgSUQg44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJyxcbiAgICAgICdJbnZhbGlkVGFzaydcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2soXG4gIG1heWJlVGFza1N0YXRlOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlVGFza1N0YXRlIGlzIFRhc2sge1xuICBpZiAoIWlzVW5rbm93blJlY29yZChtYXliZVRhc2tTdGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKCfjgr/jgrnjgq/jgYzjgqrjg5bjgrjjgqfjgq/jg4jlnovjgafjga/jgYLjgorjgb7jgZvjgpMnLCAnSW52YWxpZFRhc2snKTtcbiAgfVxuXG4gIGFzc2VydFZhbGlkVGFza0lkKG1heWJlVGFza1N0YXRlLmlkKTtcbiAgYXNzZXJ0VmFsaWRUYXNrVGl0bGUobWF5YmVUYXNrU3RhdGUudGl0bGUpO1xuICBpZiAoJ2RldGFpbCcgaW4gbWF5YmVUYXNrU3RhdGUpIHtcbiAgICBhc3NlcnRWYWxpZFRhc2tEZXRhaWwobWF5YmVUYXNrU3RhdGUuZGV0YWlsKTtcbiAgfVxuICBhc3NlcnRWYWxpZFRhc2tJc0NvbXBsZXRlKG1heWJlVGFza1N0YXRlLmlzX2NvbXBsZXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza1N0YXRlKFxuICBtYXliZVRhc2tTdGF0ZTogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tTdGF0ZSBpcyBUYXNrU3RhdGUge1xuICBhc3NlcnRWYWxpZFRhc2sobWF5YmVUYXNrU3RhdGUpO1xuICBhc3NlcnRWYWxpZFRhc2tVc2VySWQoKG1heWJlVGFza1N0YXRlIGFzIHVua25vd24gYXMgVW5rbm93blJlY29yZCkudXNlcklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkSW5jb21pbmdQYXJ0aWFsVGFzayhcbiAgbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlSW5jb21pbmdQYXJ0aWFsVGFzayBpcyBJbmNvbWluZ1BhcnRpYWxUYXNrIHtcbiAgaWYgKCFpc1Vua25vd25SZWNvcmQobWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+OBjOOCquODluOCuOOCp+OCr+ODiOWei+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG5cbiAgaWYgKCd0aXRsZScgaW4gbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSB7XG4gICAgYXNzZXJ0VmFsaWRUYXNrVGl0bGUobWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrLnRpdGxlKTtcbiAgfVxuICBpZiAoJ2RldGFpbCcgaW4gbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSB7XG4gICAgYXNzZXJ0VmFsaWRUYXNrRGV0YWlsKG1heWJlSW5jb21pbmdQYXJ0aWFsVGFzay5kZXRhaWwpO1xuICB9XG59XG5cIi4uLy4uLy4uL3V0aWxzL3ZhbGlkYXRvclwiXCIuLi8uLi8uLi91dGlscy90eXBlc1wiIiwiaW1wb3J0IHsgdHlwZSBDb21tb25FcnJvckNvZGUsIEN1c3RvbUVycm9yIH0gZnJvbSAnfi91dGlscy9jdXN0b21FcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFza0Vycm9yQ29kZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy90YXNrL2Vycm9yJztcbmltcG9ydCB0eXBlIHsgVG9rZW5FcnJvckNvZGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdG9rZW4nO1xuaW1wb3J0IHR5cGUgeyBVc2VyRXJyb3JDb2RlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuXG5leHBvcnQgdHlwZSBBcHBBcGlFcnJvckNvZGUgPVxuICB8IENvbW1vbkVycm9yQ29kZVxuICB8IFVzZXJFcnJvckNvZGVcbiAgfCBUb2tlbkVycm9yQ29kZVxuICB8IFRhc2tFcnJvckNvZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwQXBpRXJyb3Ige1xuICBjb2RlOiBBcHBBcGlFcnJvckNvZGU7XG4gIG1lc3NhZ2U6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIVFRQRXJyb3JSZXNwb25zZSB7XG4gIHN0YXR1czogbnVtYmVyO1xuICBib2R5OiBBcHBBcGlFcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yOiB1bmtub3duKTogSFRUUEVycm9yUmVzcG9uc2Uge1xuICBpZiAoIShlcnJvciBpbnN0YW5jZW9mIEN1c3RvbUVycm9yKSkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6IDUwMCxcbiAgICAgIGJvZHk6IHtcbiAgICAgICAgY29kZTogJ1VuZXhwZWN0ZWRFcnJvcicsXG4gICAgICAgIG1lc3NhZ2U6ICfjgrXjg7zjg5Djg7zlhoXjgafkuojmnJ/jgZfjgarjgYTjgqjjg6njg7zjgYznmbrnlJ/jgZfjgb7jgZfjgZ8nLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gTk9URTog44GG44G+44GE5pa55rOV44GM5oCd44GE44Gk44GL44KT44GL44Gj44GfXG4gIHN3aXRjaCAoZXJyb3IuY29kZSBhcyBBcHBBcGlFcnJvckNvZGUpIHtcbiAgICAvLyB1c2VyXG4gICAgY2FzZSAnSW52YWxpZFVzZXInOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdNaXNtYXRjaGVkUGFzc3dvcmQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDEsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdVc2VyTm90Rm91bmQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdDb25mbGljdFVzZXInOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDksXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcblxuICAgIC8vIHRva2VuXG4gICAgY2FzZSAnSW52YWxpZFRva2VuJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG4gICAgY2FzZSAnTWlzbWF0Y2hlZFRva2VuJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG4gICAgY2FzZSAnVG9rZW5SZXF1aXJlZCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwMSxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuXG4gICAgLy8gdGFza1xuICAgIGNhc2UgJ0ludmFsaWRUYXNrJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG4gICAgY2FzZSAnVGFza05vdEZvdW5kJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDA0LFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG5cbiAgICAvLyBkZWZhdWx0XG4gICAgY2FzZSAnVmFsaWRhdGVFcnJvcic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuICAgIGNhc2UgJ1VuZXhwZWN0ZWRFcnJvcic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDUwMCxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuICB9XG59XG5cIi4uLy4uL3V0aWxzL2N1c3RvbUVycm9yXCJcIi4uLy4uL2NvcmUvZmVhdHVyZXMvdGFzay9lcnJvclwiXCIuLi8uLi9jb3JlL2ZlYXR1cmVzL3Rva2VuXCJcIi4uLy4uL2NvcmUvZmVhdHVyZXMvdXNlclwiIiwiaW1wb3J0IHsgcmVzdCwgdHlwZSBEZWZhdWx0Qm9keVR5cGUsIHR5cGUgUGF0aFBhcmFtcyB9IGZyb20gJ21zdyc7XG5cbmltcG9ydCAqIGFzIHRhc2tGZWF0dXJlIGZyb20gJ34vY29yZS9mZWF0dXJlcy90YXNrJztcbmltcG9ydCAqIGFzIHRva2VuRmVhdHVyZSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdG9rZW4nO1xuXG5pbXBvcnQgeyBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZSwgdHlwZSBBcHBBcGlFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuXG5pbXBvcnQgdHlwZSB7IFJlc3RIYW5kbGVyc0NyZWF0b3IgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RvcmFnZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlJztcblxuLy8gX19fX19fX19fX1xuLy8gL2FwaS90YXNrc1xuZXhwb3J0IGludGVyZmFjZSBBcGlUYXNrcyB7XG4gIGdldDoge1xuICAgIHJlc0JvZHk6IHRhc2tGZWF0dXJlLlRhc2tbXTtcbiAgfTtcbiAgcG9zdDoge1xuICAgIHJlcUJvZHk6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBkZXRhaWw/OiBzdHJpbmc7XG4gICAgfTtcbiAgICByZXNCb2R5OiB0YXNrRmVhdHVyZS5UYXNrO1xuICB9O1xufVxuXG5jb25zdCBjcmVhdGVUYXNrc0hhbmRsZXJzOiBSZXN0SGFuZGxlcnNDcmVhdG9yID0gKGdsb2JhbFN0b3JhZ2UpID0+IHtcbiAgcmV0dXJuIFtcbiAgICByZXN0LmdldDxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIFBhdGhQYXJhbXMsXG4gICAgICBBcGlUYXNrc1snZ2V0J11bJ3Jlc0JvZHknXSB8IEFwcEFwaUVycm9yXG4gICAgPignL2FwaS90YXNrcycsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdG9rZW5GZWF0dXJlLmdldFVzZXJGcm9tVG9rZW4oe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS5nZXRUYXNrcyh7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhc2tzID0gcmVzdWx0Lm91dHB1dC50YXNrcztcblxuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24odGFza3MpKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gZXJyb3IySHR0cEVycm9yUmVzcG9uc2UoZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgfVxuICAgIH0pLFxuXG4gICAgcmVzdC5wb3N0PFxuICAgICAgQXBpVGFza3NbJ3Bvc3QnXVsncmVxQm9keSddLFxuICAgICAgUGF0aFBhcmFtcyxcbiAgICAgIEFwaVRhc2tzWydwb3N0J11bJ3Jlc0JvZHknXSB8IEFwcEFwaUVycm9yXG4gICAgPignL2FwaS90YXNrcycsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdG9rZW5GZWF0dXJlLmdldFVzZXJGcm9tVG9rZW4oe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICB0YXNrRmVhdHVyZS5hc3NlcnRWYWxpZFRhc2tUaXRsZShyZXEuYm9keS50aXRsZSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0RldGFpbChyZXEuYm9keS5kZXRhaWwpO1xuXG4gICAgICAgIGNvbnN0IGlucHV0VGFzayA9IHtcbiAgICAgICAgICB0aXRsZTogcmVxLmJvZHkudGl0bGUsXG4gICAgICAgICAgZGV0YWlsOiByZXEuYm9keS5kZXRhaWwsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGFza0ZlYXR1cmUuYWRkVGFzayh7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIHVzZXI6IHVzZXIsXG4gICAgICAgICAgICB0YXNrOiBpbnB1dFRhc2ssXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhc2sgPSByZXN1bHQub3V0cHV0LnRhc2s7XG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0LnN0YXRlKTtcblxuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24odGFzaykpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG4gIF07XG59O1xuXG4vLyBfX19fX19fX19fXG4vLyAvYXBpL3Rhc2tzLzp0YXNrSWRcbmV4cG9ydCBpbnRlcmZhY2UgQXBpVGFza3NJZCB7XG4gIHBhcmFtczoge1xuICAgIHRhc2tJZDogc3RyaW5nO1xuICB9O1xuICBnZXQ6IHtcbiAgICByZXNCb2R5OiB0YXNrRmVhdHVyZS5UYXNrO1xuICB9O1xuICBwYXRjaDoge1xuICAgIHJlcUJvZHk6IHtcbiAgICAgIHRpdGxlPzogc3RyaW5nO1xuICAgICAgZGV0YWlsPzogc3RyaW5nO1xuICAgIH07XG4gICAgcmVzQm9keTogbnVsbDtcbiAgfTtcbiAgZGVsZXRlOiB7XG4gICAgcmVzQm9keTogbnVsbDtcbiAgfTtcbn1cblxuY29uc3QgY3JlYXRlVGFza3NJZEhhbmRsZXJzOiBSZXN0SGFuZGxlcnNDcmVhdG9yID0gKGdsb2JhbFN0b3JhZ2UpID0+IHtcbiAgcmV0dXJuIFtcbiAgICByZXN0LmdldDxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIEFwaVRhc2tzSWRbJ3BhcmFtcyddLFxuICAgICAgQXBpVGFza3NJZFsnZ2V0J11bJ3Jlc0JvZHknXSB8IEFwcEFwaUVycm9yXG4gICAgPignL2FwaS90YXNrcy86dGFza0lkJywgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbih7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIG1heWJlQmVhcmVyVG9rZW46IHJlcS5oZWFkZXJzLmdldCgnQXV0aG9yaXphdGlvbicpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICB0YXNrRmVhdHVyZS5hc3NlcnRWYWxpZFRhc2tJZChyZXEucGFyYW1zLnRhc2tJZCk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGFza0ZlYXR1cmUuZ2V0VGFzayh7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgICBpZDogcmVxLnBhcmFtcy50YXNrSWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhc2sgPSByZXN1bHQub3V0cHV0LnRhc2s7XG5cbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCksIGN0eC5qc29uKHRhc2spKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gZXJyb3IySHR0cEVycm9yUmVzcG9uc2UoZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgfVxuICAgIH0pLFxuXG4gICAgcmVzdC5wYXRjaDxcbiAgICAgIEFwaVRhc2tzSWRbJ3BhdGNoJ11bJ3JlcUJvZHknXSxcbiAgICAgIEFwaVRhc2tzSWRbJ3BhcmFtcyddLFxuICAgICAgQXBpVGFza3NJZFsncGF0Y2gnXVsncmVzQm9keSddIHwgQXBwQXBpRXJyb3JcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQnLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcbiAgICAgICAgY29uc3QgaW5jb21pbmdQYXJ0aWFsVGFzayA9IHtcbiAgICAgICAgICB0aXRsZTogcmVxLmJvZHkudGl0bGUsXG4gICAgICAgICAgZGV0YWlsOiByZXEuYm9keS5kZXRhaWwsXG4gICAgICAgIH07XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkSW5jb21pbmdQYXJ0aWFsVGFzayhpbmNvbWluZ1BhcnRpYWxUYXNrKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS51cGRhdGVUYXNrKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICAgIGluY29taW5nUGFydGlhbFRhc2ssXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZ2xvYmFsU3RvcmFnZS51cGRhdGVHbG9iYWxTdGF0ZShyZXN1bHQuc3RhdGUpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcblxuICAgIHJlc3QuZGVsZXRlPFxuICAgICAgRGVmYXVsdEJvZHlUeXBlLFxuICAgICAgQXBpVGFza3NJZFsncGFyYW1zJ10sXG4gICAgICBBcGlUYXNrc0lkWydkZWxldGUnXVsncmVzQm9keSddIHwgQXBwQXBpRXJyb3JcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQnLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS5kZWxldGVUYXNrKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcblxuICAgICAgICBnbG9iYWxTdG9yYWdlLnVwZGF0ZUdsb2JhbFN0YXRlKHJlc3VsdC5zdGF0ZSk7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cygyMDApKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gZXJyb3IySHR0cEVycm9yUmVzcG9uc2UoZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgfVxuICAgIH0pLFxuICBdO1xufTtcblxuLy8gX19fX19fX19fX1xuLy8gL2FwaS90YXNrcy86dGFza0lkL2NvbXBsZXRpb25cbmV4cG9ydCBpbnRlcmZhY2UgQXBpVGFza3NJZENvbXBsZXRpb24ge1xuICBwYXJhbXM6IHtcbiAgICB0YXNrSWQ6IHN0cmluZztcbiAgfTtcbiAgcHV0OiB7XG4gICAgcmVzQm9keTogbnVsbDtcbiAgfTtcbiAgZGVsZXRlOiB7XG4gICAgcmVzQm9keTogbnVsbDtcbiAgfTtcbn1cblxuY29uc3QgY3JlYXRlVGFza3NJZENvbXBsZXRpb25IYW5kbGVyczogUmVzdEhhbmRsZXJzQ3JlYXRvciA9IChcbiAgZ2xvYmFsU3RvcmFnZVxuKSA9PiB7XG4gIHJldHVybiBbXG4gICAgcmVzdC5wdXQ8XG4gICAgICBEZWZhdWx0Qm9keVR5cGUsXG4gICAgICBBcGlUYXNrc0lkQ29tcGxldGlvblsncGFyYW1zJ10sXG4gICAgICBBcGlUYXNrc0lkQ29tcGxldGlvblsncHV0J11bJ3Jlc0JvZHknXSB8IEFwcEFwaUVycm9yXG4gICAgPignL2FwaS90YXNrcy86dGFza0lkL2NvbXBsZXRpb24nLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS51cGRhdGVUYXNrQ29tcGxldGlvbih7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgICBpZDogcmVxLnBhcmFtcy50YXNrSWQsXG4gICAgICAgICAgICBpc0NvbXBsZXRlOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0LnN0YXRlKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG5cbiAgICByZXN0LmRlbGV0ZTxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIEFwaVRhc2tzSWRDb21wbGV0aW9uWydwYXJhbXMnXSxcbiAgICAgIEFwaVRhc2tzSWRDb21wbGV0aW9uWydkZWxldGUnXVsncmVzQm9keSddIHwgQXBwQXBpRXJyb3JcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQvY29tcGxldGlvbicsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdG9rZW5GZWF0dXJlLmdldFVzZXJGcm9tVG9rZW4oe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgdGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrSWQocmVxLnBhcmFtcy50YXNrSWQpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRhc2tGZWF0dXJlLnVwZGF0ZVRhc2tDb21wbGV0aW9uKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICAgIGlzQ29tcGxldGU6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0LnN0YXRlKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCkpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG4gIF07XG59O1xuXG4vLyBfX19fX19fX19fXG4vLyBjb21iaW5lXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGFza1Jlc3RIYW5kbGVycyhnbG9iYWxTdG9yYWdlOiBHbG9iYWxTdG9yYWdlKSB7XG4gIHJldHVybiBbXG4gICAgLi4uY3JlYXRlVGFza3NIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgICAuLi5jcmVhdGVUYXNrc0lkSGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gICAgLi4uY3JlYXRlVGFza3NJZENvbXBsZXRpb25IYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgXTtcbn1cblwiLi4vLi4vY29yZS9mZWF0dXJlcy90YXNrXCJcIi4uLy4uL2NvcmUvZmVhdHVyZXMvdG9rZW5cIlwiLi4vLi4vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlXCIiLCJpbXBvcnQgeyBCYXNlNjQgfSBmcm9tICdqcy1iYXNlNjQnO1xuXG5pbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVXNlckVycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG5pbnRlcmZhY2UgTG9naW5Vc2VySW5wdXQge1xuICB1c2VybmFtZTogc3RyaW5nO1xuICBwYXNzd29yZDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgTG9naW5Vc2VyUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xuICBvdXRwdXRzOiB7XG4gICAgdG9rZW46IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ2luVXNlcihcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxMb2dpblVzZXJJbnB1dD5cbik6IFByb21pc2U8TG9naW5Vc2VyUmV0dXJuPiB7XG4gIGNvbnN0IHsgaW5wdXQsIHN0YXRlIH0gPSBwcm9wcztcbiAgY29uc3QgbmV3U3RhdGUgPSBkZWVwQ29weVdpdGhXcml0ZWFibGUoc3RhdGUpO1xuXG4gIGNvbnN0IHRhcmdldFVzZXIgPSBzdGF0ZS51c2Vycy5maW5kKCh1KSA9PiB1LnVzZXJuYW1lID09PSBpbnB1dC51c2VybmFtZSk7XG4gIGlmICghdGFyZ2V0VXNlcikge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoXG4gICAgICBg44Om44O844K244O8ICR7aW5wdXQudXNlcm5hbWV9IOOBjOWtmOWcqOOBl+OBvuOBm+OCk2AsXG4gICAgICAnVXNlck5vdEZvdW5kJ1xuICAgICk7XG4gIH1cblxuICBpZiAodGFyZ2V0VXNlci5wYXNzd29yZCAhPT0gaW5wdXQucGFzc3dvcmQpIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKFxuICAgICAgYOODpuODvOOCtuODvCAke2lucHV0LnVzZXJuYW1lfSDjga/opovjgaTjgYvjgorjgb7jgZfjgZ/jgYzjgIHjg5Hjgrnjg6/jg7zjg4kgJHtpbnB1dC5wYXNzd29yZH0g44GM5q2j44GX44GP44GC44KK44G+44Gb44KTYCxcbiAgICAgICdNaXNtYXRjaGVkUGFzc3dvcmQnXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gQmFzZTY0LmVuY29kZShcbiAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICB1c2VyOiBpbnB1dC51c2VybmFtZSxcbiAgICAgIGRhdGU6IG5ldyBEYXRlKCksXG4gICAgfSlcbiAgKTtcbiAgbmV3U3RhdGUudXNlcnMuZm9yRWFjaCgodXNlcikgPT4ge1xuICAgIGlmICh1c2VyLnVzZXJuYW1lID09PSBpbnB1dC51c2VybmFtZSkge1xuICAgICAgdXNlci50b2tlbiA9IHRva2VuO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBzdGF0ZTogbmV3U3RhdGUsXG4gICAgb3V0cHV0czoge1xuICAgICAgdG9rZW4sXG4gICAgfSxcbiAgfTtcbn1cblwiLi4vLi4vLi4vdXRpbHMvZGVlcENvcHlcIlwiLi4vLi4vZ2xvYmFsU3RhdGVcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdGF0ZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZSc7XG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJ34vY29yZS90eXBlcyc7XG5cbmludGVyZmFjZSBMb2dvdXRVc2VySW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dvdXRVc2VyKFxuICBwcm9wczogV2l0aERCU3RhdGVSZWFkb25seUlucHV0PExvZ291dFVzZXJJbnB1dD5cbik6IFByb21pc2U8R2xvYmFsU3RhdGU+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgbmV3U3RhdGUudXNlcnMuZm9yRWFjaCgodXNlcikgPT4ge1xuICAgIGlmICh1c2VyLmlkID09PSBpbnB1dC51c2VyLmlkKSB7XG4gICAgICBkZWxldGUgdXNlci50b2tlbjtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBuZXdTdGF0ZTtcbn1cblwiLi4vLi4vLi4vdXRpbHMvZGVlcENvcHlcIlwiLi4vLi4vZ2xvYmFsU3RhdGVcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuaW1wb3J0IHsgc2hhMjU2IH0gZnJvbSAnfi91dGlscy9zaGEyNTYnO1xuXG5pbXBvcnQgeyBVc2VyRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICcuLi8uLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0YXRlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlJztcblxuaW50ZXJmYWNlIFJlZ2lzdGVyVXNlcklucHV0IHtcbiAgdXNlcm5hbWU6IHN0cmluZztcbiAgcGFzc3dvcmQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyVXNlcihcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxSZWdpc3RlclVzZXJJbnB1dD5cbik6IFByb21pc2U8R2xvYmFsU3RhdGU+IHtcbiAgY29uc3QgeyBpbnB1dCwgc3RhdGUgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgaWYgKHN0YXRlLnVzZXJzLmZpbHRlcigodSkgPT4gdS51c2VybmFtZSA9PT0gaW5wdXQudXNlcm5hbWUpLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKFxuICAgICAgYOODpuODvOOCtuODvCAke2lucHV0LnVzZXJuYW1lfSDjga/ml6LjgavnmbvpjLLjgZXjgozjgabjgYTjgb7jgZlgLFxuICAgICAgJ0NvbmZsaWN0VXNlcidcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaWQgPSBhd2FpdCBzaGEyNTYoaW5wdXQudXNlcm5hbWUpO1xuICBuZXdTdGF0ZS51c2Vycy5wdXNoKHtcbiAgICB1c2VybmFtZTogaW5wdXQudXNlcm5hbWUsXG4gICAgcGFzc3dvcmQ6IGlucHV0LnBhc3N3b3JkLFxuICAgIGlkLFxuICB9KTtcblxuICByZXR1cm4gbmV3U3RhdGU7XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uLy4uLy4uL3V0aWxzL3NoYTI1NlwiXCIuLi8uLi9nbG9iYWxTdGF0ZVwiIiwiaW1wb3J0IHsgdHlwZSBQYXRoUGFyYW1zLCByZXN0LCBEZWZhdWx0Qm9keVR5cGUgfSBmcm9tICdtc3cnO1xuXG5pbXBvcnQgKiBhcyB0b2tlbkZlYXR1cmUgZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3Rva2VuJztcbmltcG9ydCAqIGFzIHVzZXJGZWF0dXJlIGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcblxuaW1wb3J0IHsgZXJyb3IySHR0cEVycm9yUmVzcG9uc2UsIEFwcEFwaUVycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgUmVzdEhhbmRsZXJzQ3JlYXRvciB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdG9yYWdlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2UnO1xuXG4vLyBfX19fX19fX19fXG4vLyAvYXBpL3VzZXJzL3JlZ2lzdGVyXG5leHBvcnQgaW50ZXJmYWNlIEFwaVVzZXJzUmVnaXN0ZXIge1xuICBwb3N0OiB7XG4gICAgcmVxQm9keToge1xuICAgICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfTtcbiAgICByZXNCb2R5OiBudWxsO1xuICB9O1xufVxuXG5jb25zdCBjcmVhdGVVc2Vyc1JlZ2lzdGVySGFuZGxlcnM6IFJlc3RIYW5kbGVyc0NyZWF0b3IgPSAoZ2xvYmFsU3RvcmFnZSkgPT4ge1xuICByZXR1cm4gW1xuICAgIHJlc3QucG9zdDxBcGlVc2Vyc1JlZ2lzdGVyWydwb3N0J11bJ3JlcUJvZHknXSwgUGF0aFBhcmFtcywgQXBwQXBpRXJyb3I+KFxuICAgICAgJy9hcGkvdXNlcnMvcmVnaXN0ZXInLFxuICAgICAgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFVzZXJOYW1lKHJlcS5ib2R5LnVzZXJuYW1lKTtcbiAgICAgICAgICB1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFBhc3N3b3JkKHJlcS5ib2R5LnBhc3N3b3JkKTtcbiAgICAgICAgICBjb25zdCB1c2VySW5mbyA9IHtcbiAgICAgICAgICAgIHVzZXJuYW1lOiByZXEuYm9keS51c2VybmFtZSxcbiAgICAgICAgICAgIHBhc3N3b3JkOiByZXEuYm9keS5wYXNzd29yZCxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlckZlYXR1cmUucmVnaXN0ZXJVc2VyKHtcbiAgICAgICAgICAgIGlucHV0OiB1c2VySW5mbyxcbiAgICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0KTtcblxuICAgICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cygyMDApKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgKSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdXNlcnMvbG9naW5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpVXNlcnNMb2dpbiB7XG4gIHBvc3Q6IHtcbiAgICByZXFCb2R5OiB7XG4gICAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9O1xuICAgIHJlc0JvZHk6IHtcbiAgICAgIHRva2VuOiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbn1cblxuY29uc3QgY3JlYXRlVXNlcnNMb2dpbkhhbmRsZXJzOiBSZXN0SGFuZGxlcnNDcmVhdG9yID0gKGdsb2JhbFN0b3JhZ2UpID0+IHtcbiAgcmV0dXJuIFtcbiAgICByZXN0LnBvc3Q8XG4gICAgICBBcGlVc2Vyc0xvZ2luWydwb3N0J11bJ3JlcUJvZHknXSxcbiAgICAgIFBhdGhQYXJhbXMsXG4gICAgICBBcGlVc2Vyc0xvZ2luWydwb3N0J11bJ3Jlc0JvZHknXSB8IEFwcEFwaUVycm9yXG4gICAgPignL2FwaS91c2Vycy9sb2dpbicsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICB1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFVzZXJOYW1lKHJlcS5ib2R5LnVzZXJuYW1lKTtcbiAgICAgICAgdXNlckZlYXR1cmUuYXNzZXJ0VmFsaWRQYXNzd29yZChyZXEuYm9keS5wYXNzd29yZCk7XG4gICAgICAgIGNvbnN0IHVzZXJJbmZvID0ge1xuICAgICAgICAgIHVzZXJuYW1lOiByZXEuYm9keS51c2VybmFtZSxcbiAgICAgICAgICBwYXNzd29yZDogcmVxLmJvZHkucGFzc3dvcmQsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlckZlYXR1cmUubG9naW5Vc2VyKHtcbiAgICAgICAgICBpbnB1dDogdXNlckluZm8sXG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgIH0pO1xuICAgICAgICBnbG9iYWxTdG9yYWdlLnVwZGF0ZUdsb2JhbFN0YXRlKHJlc3VsdC5zdGF0ZSk7XG5cbiAgICAgICAgcmV0dXJuIHJlcyhcbiAgICAgICAgICBjdHguc3RhdHVzKDIwMCksXG4gICAgICAgICAgY3R4Lmpzb24oe1xuICAgICAgICAgICAgdG9rZW46IHJlc3VsdC5vdXRwdXRzLnRva2VuLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdXNlcnMvbG9nb3V0XG5leHBvcnQgaW50ZXJmYWNlIEFwaVVzZXJzTG9nb3V0IHtcbiAgcG9zdDoge1xuICAgIHJlcUhlYWRlcnM6IHtcbiAgICAgIEF1dGhvcml6YXRpb246IHN0cmluZztcbiAgICB9O1xuICAgIHJlc0JvZHk6IG51bGw7XG4gIH07XG59XG5cbmNvbnN0IGNyZWF0ZVVzZXJzTG9nb3V0SGFuZGxlcnM6IFJlc3RIYW5kbGVyc0NyZWF0b3IgPSAoZ2xvYmFsU3RvcmFnZSkgPT4ge1xuICByZXR1cm4gW1xuICAgIHJlc3QucG9zdDxEZWZhdWx0Qm9keVR5cGUsIFBhdGhQYXJhbXMsIEFwcEFwaUVycm9yPihcbiAgICAgICcvYXBpL3VzZXJzL2xvZ291dCcsXG4gICAgICBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbih7XG4gICAgICAgICAgICBpbnB1dDogeyBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSB9LFxuICAgICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyRmVhdHVyZS5sb2dvdXRVc2VyKHtcbiAgICAgICAgICAgIGlucHV0OiB7IHVzZXIgfSxcbiAgICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0KTtcblxuICAgICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cygyMDApKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgKSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIGNvbWJpbmVcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVVc2VyUmVzdEhhbmRsZXJzKGdsb2JhbFN0b3JhZ2U6IEdsb2JhbFN0b3JhZ2UpIHtcbiAgcmV0dXJuIFtcbiAgICAuLi5jcmVhdGVVc2Vyc1JlZ2lzdGVySGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gICAgLi4uY3JlYXRlVXNlcnNMb2dpbkhhbmRsZXJzKGdsb2JhbFN0b3JhZ2UpLFxuICAgIC4uLmNyZWF0ZVVzZXJzTG9nb3V0SGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gIF07XG59XG5cIi4uLy4uL2NvcmUvZmVhdHVyZXMvdG9rZW5cIlwiLi4vLi4vY29yZS9mZWF0dXJlcy91c2VyXCJcIi4uLy4uL2NvcmUvZ2xvYmFsU3RhdGUvZ2xvYmFsU3RvcmFnZVwiIiwiaW1wb3J0IHsgcmVzdCwgdHlwZSBEZWZhdWx0Qm9keVR5cGUsIHR5cGUgUGF0aFBhcmFtcyB9IGZyb20gJ21zdyc7XG5cbmltcG9ydCB7IGNyZWF0ZVRhc2tSZXN0SGFuZGxlcnMgfSBmcm9tICcuL3Rhc2tSZXN0SGFuZGxlcnMnO1xuaW1wb3J0IHsgY3JlYXRlVXNlclJlc3RIYW5kbGVycyB9IGZyb20gJy4vdXNlclJlc3RIYW5kbGVycyc7XG5cbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RvcmFnZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlJztcblxuZXhwb3J0IGludGVyZmFjZSBBcGlIZWFsdGgge1xuICBnZXQ6IHtcbiAgICByZXNCb2R5OiB7XG4gICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlc3RIYW5kbGVycyhnbG9iYWxTdG9yYWdlOiBHbG9iYWxTdG9yYWdlKSB7XG4gIGNvbnN0IHJlc3RIYW5kbGVycyA9IFtcbiAgICByZXN0LmdldDxEZWZhdWx0Qm9keVR5cGUsIFBhdGhQYXJhbXMsIEFwaUhlYWx0aFsnZ2V0J11bJ3Jlc0JvZHknXT4oXG4gICAgICAnL2FwaS9oZWFsdGgnLFxuICAgICAgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCksIGN0eC5qc29uKHsgbWVzc2FnZTogXCJJJ20gaGVhbHRoeSFcIiB9KSk7XG4gICAgICB9XG4gICAgKSxcbiAgICAuLi5jcmVhdGVVc2VyUmVzdEhhbmRsZXJzKGdsb2JhbFN0b3JhZ2UpLFxuICAgIC4uLmNyZWF0ZVRhc2tSZXN0SGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gIF07XG5cbiAgcmV0dXJuIHJlc3RIYW5kbGVycztcbn1cblwiLi4vLi4vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlXCIiLCJpbXBvcnQgeyBzZXR1cFdvcmtlciB9IGZyb20gJ21zdyc7XG5cbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFN0b3JhZ2UgfSBmcm9tICcuL2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHsgY3JlYXRlUmVzdEhhbmRsZXJzIH0gZnJvbSAnLi9oYW5kbGVycy9yZXN0JztcblxuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdG9yZU9wdGlvbiB9IGZyb20gJy4vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlJztcblxuZXhwb3J0IHR5cGUgV29ya2VyT3B0aW9uID0gR2xvYmFsU3RvcmVPcHRpb247XG5cbmV4cG9ydCBjb25zdCBzdGFydFdvcmtlciA9IChvcHRpb24/OiBXb3JrZXJPcHRpb24pID0+IHtcbiAgY29uc3QgZ2xvYmFsU3RvcmFnZSA9IGNyZWF0ZUdsb2JhbFN0b3JhZ2Uob3B0aW9uKTtcblxuICBjb25zdCB3b3JrZXIgPSBzZXR1cFdvcmtlciguLi5jcmVhdGVSZXN0SGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSkpO1xuXG4gIHdvcmtlci5zdGFydCgpO1xufTtcbiIsImltcG9ydCB7IHNldHVwU2VydmVyIH0gZnJvbSAnbXN3L25vZGUnO1xuXG5pbXBvcnQge1xuICBjcmVhdGVHbG9iYWxTdG9yYWdlLFxuICBHbG9iYWxTdG9yZU9wdGlvbixcbn0gZnJvbSAnLi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2UnO1xuaW1wb3J0IHsgY3JlYXRlUmVzdEhhbmRsZXJzIH0gZnJvbSAnLi9oYW5kbGVycy9yZXN0JztcblxuZXhwb3J0IHR5cGUgU2VydmVyT3B0aW9uID0gT21pdDxHbG9iYWxTdG9yZU9wdGlvbiwgJ3N0b3JlVHlwZSc+O1xuXG5leHBvcnQgY29uc3QgY3JlYXRlU2VydmVyID0gKG9wdGlvbj86IFNlcnZlck9wdGlvbikgPT4ge1xuICBjb25zdCBnbG9iYWxTdG9yYWdlID0gY3JlYXRlR2xvYmFsU3RvcmFnZSh7XG4gICAgLi4ub3B0aW9uLFxuICAgIHN0b3JlVHlwZTogJ25vdGhpbmcnLFxuICB9KTtcblxuICByZXR1cm4gc2V0dXBTZXJ2ZXIoLi4uY3JlYXRlUmVzdEhhbmRsZXJzKGdsb2JhbFN0b3JhZ2UpKTtcbn07XG4iLCJpbXBvcnQgdHlwZSB7XG4gIEFwaUhlYWx0aCxcbiAgQXBpVGFza3MsXG4gIEFwaVVzZXJzUmVnaXN0ZXIsXG4gIEFwaVVzZXJzTG9naW4sXG4gIEFwaVVzZXJzTG9nb3V0LFxuICBBcHBBcGlFcnJvcixcbiAgQXBpVGFza3NJZCxcbiAgQXBpVGFza3NJZENvbXBsZXRpb24sXG59IGZyb20gJ34vaGFuZGxlcnMvcmVzdCc7XG5cbmV4cG9ydCB0eXBlIEFwaVJlc3BvbnNlPFN1Y2Nlc3NSZXNwb25zZUJvZHk+ID0gUHJvbWlzZTxcbiAgfCB7XG4gICAgICBvazogZmFsc2U7XG4gICAgICBib2R5OiBBcHBBcGlFcnJvcjtcbiAgICB9XG4gIHwge1xuICAgICAgb2s6IHRydWU7XG4gICAgICBib2R5OiBTdWNjZXNzUmVzcG9uc2VCb2R5O1xuICAgIH1cbj47XG5cbmV4cG9ydCBjb25zdCByZXN0QXBpID0ge1xuICBoZWFsdGg6IHtcbiAgICBnZXQ6IGFzeW5jICgpOiBBcGlSZXNwb25zZTxBcGlIZWFsdGhbJ2dldCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL2hlYWx0aCcpO1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgIGJvZHksXG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG5cbiAgdXNlcnM6IHtcbiAgICByZWdpc3Rlcjoge1xuICAgICAgcG9zdDogYXN5bmMgKFxuICAgICAgICBwYXlsb2FkOiBBcGlVc2Vyc1JlZ2lzdGVyWydwb3N0J11bJ3JlcUJvZHknXVxuICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVXNlcnNSZWdpc3RlclsncG9zdCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdXNlcnMvcmVnaXN0ZXInLCB7XG4gICAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgYm9keSA9IHJlcy5vayA/IG51bGwgOiBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICBib2R5LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9LFxuICAgIGxvZ2luOiB7XG4gICAgICBwb3N0OiBhc3luYyAoXG4gICAgICAgIHBheWxvYWQ6IEFwaVVzZXJzTG9naW5bJ3Bvc3QnXVsncmVxQm9keSddXG4gICAgICApOiBBcGlSZXNwb25zZTxBcGlVc2Vyc0xvZ2luWydwb3N0J11bJ3Jlc0JvZHknXT4gPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS91c2Vycy9sb2dpbicsIHtcbiAgICAgICAgICBtZXRob2Q6ICdwb3N0JyxcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgICAgYm9keSxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICBsb2dvdXQ6IHtcbiAgICAgIHBvc3Q6IGFzeW5jIChcbiAgICAgICAgdG9rZW46IHN0cmluZ1xuICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVXNlcnNMb2dvdXRbJ3Bvc3QnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL3VzZXJzL2xvZ291dCcsIHtcbiAgICAgICAgICBtZXRob2Q6ICdwb3N0JyxcbiAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgYm9keSA9IHJlcy5vayA/IG51bGwgOiBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICBib2R5LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9LFxuICB9LFxuXG4gIHRhc2tzOiB7XG4gICAgZ2V0OiBhc3luYyAodG9rZW46IHN0cmluZyk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzWydnZXQnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS90YXNrcycsIHtcbiAgICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgYm9keSxcbiAgICAgIH07XG4gICAgfSxcbiAgICBwb3N0OiBhc3luYyAoXG4gICAgICBwYXlsb2FkOiBBcGlUYXNrc1sncG9zdCddWydyZXFCb2R5J10sXG4gICAgICB0b2tlbjogc3RyaW5nXG4gICAgKTogQXBpUmVzcG9uc2U8QXBpVGFza3NbJ3Bvc3QnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS90YXNrcycsIHtcbiAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgIGJvZHksXG4gICAgICB9O1xuICAgIH0sXG4gICAgX3Rhc2tJZDogKHRhc2tJZDogc3RyaW5nKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBnZXQ6IGFzeW5jIChcbiAgICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzSWRbJ2dldCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdnZXQnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgcGF0Y2g6IGFzeW5jIChcbiAgICAgICAgICBwYXlsb2FkOiBBcGlUYXNrc0lkWydwYXRjaCddWydyZXFCb2R5J10sXG4gICAgICAgICAgdG9rZW46IHN0cmluZ1xuICAgICAgICApOiBBcGlSZXNwb25zZTxBcGlUYXNrc0lkWydwYXRjaCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdwYXRjaCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSByZXMub2sgPyBudWxsIDogYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogcmVzLm9rLFxuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IGFzeW5jIChcbiAgICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzSWRbJ2RlbGV0ZSddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdkZWxldGUnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgYm9keSA9IHJlcy5vayA/IG51bGwgOiBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgY29tcGxldGlvbjoge1xuICAgICAgICAgIHB1dDogYXN5bmMgKFxuICAgICAgICAgICAgdG9rZW46IHN0cmluZ1xuICAgICAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzSWRDb21wbGV0aW9uWydwdXQnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH0vY29tcGxldGlvbmAsIHtcbiAgICAgICAgICAgICAgbWV0aG9kOiAncHV0JyxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gcmVzLm9rID8gbnVsbCA6IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZGVsZXRlOiBhc3luYyAoXG4gICAgICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVGFza3NJZENvbXBsZXRpb25bJ2RlbGV0ZSddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL3Rhc2tzLyR7dGFza0lkfS9jb21wbGV0aW9uYCwge1xuICAgICAgICAgICAgICBtZXRob2Q6ICdkZWxldGUnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSByZXMub2sgPyBudWxsIDogYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbn07XG5cIi4uL2hhbmRsZXJzL3Jlc3RcIiJdLCJuYW1lcyI6WyJ0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbiIsInRhc2tGZWF0dXJlLmdldFRhc2tzIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrVGl0bGUiLCJ0YXNrRmVhdHVyZS5hc3NlcnRWYWxpZFRhc2tEZXRhaWwiLCJ0YXNrRmVhdHVyZS5hZGRUYXNrIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrSWQiLCJ0YXNrRmVhdHVyZS5nZXRUYXNrIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRJbmNvbWluZ1BhcnRpYWxUYXNrIiwidGFza0ZlYXR1cmUudXBkYXRlVGFzayIsInRhc2tGZWF0dXJlLmRlbGV0ZVRhc2siLCJ0YXNrRmVhdHVyZS51cGRhdGVUYXNrQ29tcGxldGlvbiIsInVzZXJGZWF0dXJlLmFzc2VydFZhbGlkVXNlck5hbWUiLCJ1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFBhc3N3b3JkIiwidXNlckZlYXR1cmUucmVnaXN0ZXJVc2VyIiwidXNlckZlYXR1cmUubG9naW5Vc2VyIiwidXNlckZlYXR1cmUubG9nb3V0VXNlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O1NBRWdCLGlCQUFpQixHQUFBO0lBQy9CLE1BQU0saUJBQWlCLEdBQUcsMkJBQTJCLENBQUM7QUFFdEQsSUFB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
