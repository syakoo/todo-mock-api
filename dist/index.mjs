/*!
  @syakoo/todo-mock-api v0.0.0
  https://github.com/syakoo/todo-mock-api#readme
  Released under the MIT License.
*/
import { rest, setupWorker } from 'msw';
import { Base64 } from 'js-base64';

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
                const task = result.output.task;
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200), ctx.json(task));
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
                return res(ctx.status(200), ctx.json({ success: true }));
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
                const task = result.output.task;
                globalStorage.updateGlobalState(result.state);
                return res(ctx.status(200), ctx.json(task));
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
                return res(ctx.status(200), ctx.json({
                    success: true,
                }));
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
                    success: true,
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
                return res(ctx.status(200), ctx.json({
                    success: true,
                }));
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
                const body = await res.json();
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
                const body = await res.json();
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
                    const body = await res.json();
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
                    const body = await res.json();
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
                        const body = await res.json();
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
                        const body = await res.json();
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

export { index as client, startWorker };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgubWpzIiwic291cmNlcyI6WyIuLi9zcmMvc3RvcmUvbG9jYWxTdG9yYWdlLnRzIiwiLi4vc3JjL3V0aWxzL2RlZXBDb3B5LnRzIiwiLi4vc3JjL3V0aWxzL2N1c3RvbUVycm9yLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdG9rZW4vZXJyb3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90b2tlbi92YWxpZGF0b3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90b2tlbi9nZXRVc2VyRnJvbVRva2VuLnRzIiwiLi4vc3JjL3V0aWxzL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvZXJyb3IudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy91c2VyL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0YXRlLnRzIiwiLi4vc3JjL2NvcmUvZ2xvYmFsU3RhdGUvZ2xvYmFsU3RvcmFnZS50cyIsIi4uL3NyYy91dGlscy9zaGEyNTYudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL2FkZFRhc2sudHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL2Vycm9yLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdGFzay9kZWxldGVUYXNrLnRzIiwiLi4vc3JjL2NvcmUvZmVhdHVyZXMvdGFzay9nZXRUYXNrcy50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svZ2V0VGFzay50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svdXBkYXRlVGFzay50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3Rhc2svdXBkYXRlVGFza0NvbXBsZXRpb24udHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy90YXNrL3ZhbGlkYXRvci50cyIsIi4uL3NyYy9oYW5kbGVycy9yZXN0L2Vycm9yLnRzIiwiLi4vc3JjL2hhbmRsZXJzL3Jlc3QvdGFza1Jlc3RIYW5kbGVycy50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvbG9naW4udHMiLCIuLi9zcmMvY29yZS9mZWF0dXJlcy91c2VyL2xvZ291dC50cyIsIi4uL3NyYy9jb3JlL2ZlYXR1cmVzL3VzZXIvcmVnaXN0ZXIudHMiLCIuLi9zcmMvaGFuZGxlcnMvcmVzdC91c2VyUmVzdEhhbmRsZXJzLnRzIiwiLi4vc3JjL2hhbmRsZXJzL3Jlc3QvcmVzdEhhbmRsZXJzLnRzIiwiLi4vc3JjL3dvcmtlci50cyIsIi4uL3NyYy9jbGllbnQvcmVzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdG9yZSB9IGZyb20gJy4vdHlwZXMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBMb2NhbFN0b3JhZ2U8VCBleHRlbmRzIG9iamVjdD4oKTogU3RvcmU8VD4ge1xuICBjb25zdCBMT0NBTF9TVE9SQUdFX0tFWSA9ICdUT0RPX01PQ0tfQVBJX1NUT1JBR0VfS0VZJztcblxuICBjb25zdCBzdG9yZTogU3RvcmU8VD4gPSB7XG4gICAgZ2V0RGF0YTogKCkgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKExPQ0FMX1NUT1JBR0VfS0VZKTtcbiAgICAgIHJldHVybiBkYXRhICYmIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfSxcblxuICAgIHNldERhdGE6IChzdGF0ZSkgPT4ge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oTE9DQUxfU1RPUkFHRV9LRVksIEpTT04uc3RyaW5naWZ5KHN0YXRlKSk7XG4gICAgfSxcbiAgfTtcblxuICByZXR1cm4gc3RvcmU7XG59XG4iLCJpbXBvcnQgeyBEZWVwV3JpdGVhYmxlIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8qKlxuICog44Kq44OW44K444Kn44Kv44OI44KS44OH44Kj44O844OX44Kz44OU44O844GX44GmIHJlYWRvbmx5IOOCkuino+mZpOOBmeOCi1xuICovXG5leHBvcnQgZnVuY3Rpb24gZGVlcENvcHlXaXRoV3JpdGVhYmxlPFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oXG4gIG9iamVjdDogVFxuKTogRGVlcFdyaXRlYWJsZTxUPiB7XG4gIC8vIE5vdGU6IOODh+OCo+ODvOODl+OCs+ODlOODvOOBl+OBn+e1kOaenOOBr+OBhOOBmOOBo+OBpuOCguWVj+mhjOOBquOBhOOBruOBpyByZWFkb25seSDjgpLmtojjgZlcbiAgLy8g5raI44GX44Gf44GP44Gq44GE44Gu44Gn44GC44KM44GwIHN0cnVjdHVyZWRDbG9uZSDjgpLjgZ3jga7jgb7jgb7kvb/jgaPjgabjgY/jgoxcbiAgcmV0dXJuIHN0cnVjdHVyZWRDbG9uZShvYmplY3QpIGFzIHVua25vd24gYXMgRGVlcFdyaXRlYWJsZTxUPjtcbn1cbiIsImV4cG9ydCB0eXBlIENvbW1vbkVycm9yQ29kZSA9ICdWYWxpZGF0ZUVycm9yJyB8ICdVbmV4cGVjdGVkRXJyb3InO1xuXG4vKipcbiAqIOOCqOODqeODvOOCr+ODqeOCuVxuICovXG5leHBvcnQgY2xhc3MgQ3VzdG9tRXJyb3I8VCBleHRlbmRzIHN0cmluZyA9IHN0cmluZz4gZXh0ZW5kcyBFcnJvciB7XG4gIGNvZGU6IFQgfCBDb21tb25FcnJvckNvZGU7XG5cbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBjb2RlOiBUIHwgQ29tbW9uRXJyb3JDb2RlKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgLy8g6ZaL55m66ICF55So44Gu44Ko44Op44O844Oh44OD44K744O844K4XG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbiAgICAvLyDjgqLjg5fjg6rjga7jgqjjg6njg7zjgrPjg7zjg4lcbiAgICB0aGlzLmNvZGUgPSBjb2RlO1xuICB9XG5cbiAgdG9Kc29uKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjb2RlOiB0aGlzLmNvZGUsXG4gICAgICBtZXNzYWdlOiB0aGlzLm1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQ3VzdG9tRXJyb3IgfSBmcm9tICd+L3V0aWxzL2N1c3RvbUVycm9yJztcblxuZXhwb3J0IHR5cGUgVG9rZW5FcnJvckNvZGUgPVxuICB8ICdJbnZhbGlkVG9rZW4nXG4gIHwgJ01pc21hdGNoZWRUb2tlbidcbiAgfCAnVG9rZW5SZXF1aXJlZCc7XG5cbmV4cG9ydCBjbGFzcyBUb2tlbkVycm9yIGV4dGVuZHMgQ3VzdG9tRXJyb3I8VG9rZW5FcnJvckNvZGU+IHt9XG5cIi4uLy4uLy4uL3V0aWxzL2N1c3RvbUVycm9yXCIiLCJpbXBvcnQgeyBUb2tlbkVycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRva2VuKFxuICB0b2tlbjogdW5rbm93blxuKTogYXNzZXJ0cyB0b2tlbiBpcyBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodG9rZW4gPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXG4gIGlmICh0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoJ+ODiOODvOOCr+ODs+OBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVG9rZW4nKTtcbiAgfVxuXG4gIGlmICghL15bMC05YS16QS1aLS5ffisvXSs9KiQvLnRlc3QodG9rZW4pKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAn44OI44O844Kv44Oz44GvIHRva2VuNjgg44Gu5b2i5byP44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZJyxcbiAgICAgICdJbnZhbGlkVG9rZW4nXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tBbmRHZXRCZWFyZXJUb2tlbih2YWx1ZTogdW5rbm93bik6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAnYmVhcmVyIHRva2VuIOOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCk+OAguioreWumuOBleOCjOOBpuOBhOOBquOBhOWPr+iDveaAp+OBjOOBguOCiuOBvuOBmeOAgicsXG4gICAgICAnSW52YWxpZFRva2VuJ1xuICAgICk7XG4gIH1cblxuICBjb25zdCByZWdleEJlYXJlclRva2VuID0gL0JlYXJlclxccysoPzx0b2tlbj5cXFMqKS87XG4gIGNvbnN0IG1hdGNoZWRUb2tlbiA9IHZhbHVlLm1hdGNoKHJlZ2V4QmVhcmVyVG9rZW4pO1xuICBjb25zdCB0b2tlbiA9IG1hdGNoZWRUb2tlbj8uZ3JvdXBzPy50b2tlbjtcblxuICBpZiAoIXRva2VuKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoJ3Rva2VuIOOBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn+OAgicsICdJbnZhbGlkVG9rZW4nKTtcbiAgfVxuICBhc3NlcnRWYWxpZFRva2VuKHRva2VuKTtcblxuICByZXR1cm4gdG9rZW47XG59XG4iLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVG9rZW5FcnJvciB9IGZyb20gJy4vZXJyb3InO1xuaW1wb3J0IHsgY2hlY2tBbmRHZXRCZWFyZXJUb2tlbiB9IGZyb20gJy4vdmFsaWRhdG9yJztcblxuaW1wb3J0IHR5cGUgeyBVc2VyU3RhdGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdXNlcic7XG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJ34vY29yZS90eXBlcyc7XG5cbmludGVyZmFjZSBHZXRVc2VyRnJvbVRva2VuSW5wdXQge1xuICBtYXliZUJlYXJlclRva2VuOiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXNlckZyb21Ub2tlbihcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxHZXRVc2VyRnJvbVRva2VuSW5wdXQ+XG4pOiBQcm9taXNlPFVzZXJTdGF0ZT4ge1xuICBjb25zdCB7IGlucHV0LCBzdGF0ZSB9ID0gcHJvcHM7XG4gIGNvbnN0IGNsb25lU3RhdGUgPSBkZWVwQ29weVdpdGhXcml0ZWFibGUoc3RhdGUpO1xuXG4gIGlmIChpbnB1dC5tYXliZUJlYXJlclRva2VuID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IFRva2VuRXJyb3IoXG4gICAgICAn44Oq44K544Ko44K544OI44OY44OD44OA44GrIEF1dGhvcml6YXRpb24g44GM5a2Y5Zyo44GX44G+44Gb44KTJyxcbiAgICAgICdUb2tlblJlcXVpcmVkJ1xuICAgICk7XG4gIH1cblxuICBjb25zdCB0b2tlbiA9IGNoZWNrQW5kR2V0QmVhcmVyVG9rZW4oaW5wdXQubWF5YmVCZWFyZXJUb2tlbik7XG5cbiAgY29uc3QgdXNlciA9IGNsb25lU3RhdGUudXNlcnMuZmluZCgodSkgPT4gdS50b2tlbiA9PT0gdG9rZW4pO1xuICBpZiAoIXVzZXIpIHtcbiAgICB0aHJvdyBuZXcgVG9rZW5FcnJvcihcbiAgICAgICfjg4jjg7zjgq/jg7Pjga7lgKTjgavoqbLlvZPjgZnjgovjg6bjg7zjgrbjg7zjgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ8nLFxuICAgICAgJ01pc21hdGNoZWRUb2tlbidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHVzZXI7XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IFVua25vd25SZWNvcmQgfSBmcm9tICcuL3R5cGVzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzVW5rbm93blJlY29yZCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFVua25vd25SZWNvcmQge1xuICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jztcbn1cbiIsImltcG9ydCB7IEN1c3RvbUVycm9yIH0gZnJvbSAnfi91dGlscy9jdXN0b21FcnJvcic7XG5cbmV4cG9ydCB0eXBlIFVzZXJFcnJvckNvZGUgPVxuICB8ICdDb25mbGljdFVzZXInXG4gIHwgJ0ludmFsaWRVc2VyJ1xuICB8ICdNaXNtYXRjaGVkUGFzc3dvcmQnXG4gIHwgJ1VzZXJOb3RGb3VuZCc7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRXJyb3IgZXh0ZW5kcyBDdXN0b21FcnJvcjxVc2VyRXJyb3JDb2RlPiB7fVxuXCIuLi8uLi8uLi91dGlscy9jdXN0b21FcnJvclwiIiwiaW1wb3J0IHsgYXNzZXJ0VmFsaWRUb2tlbiB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy90b2tlbic7XG5pbXBvcnQgeyBpc1Vua25vd25SZWNvcmQgfSBmcm9tICd+L3V0aWxzL3ZhbGlkYXRvcic7XG5cbmltcG9ydCB7IFVzZXJFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuXG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSwgVXNlciB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy90eXBlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFVzZXJOYW1lKFxuICB1c2VybmFtZTogdW5rbm93blxuKTogYXNzZXJ0cyB1c2VybmFtZSBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIHVzZXJuYW1lICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoJ+ODpuODvOOCtuODvOWQjeOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVXNlcicpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFBhc3N3b3JkKFxuICBwYXNzd29yZDogdW5rbm93blxuKTogYXNzZXJ0cyBwYXNzd29yZCBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIHBhc3N3b3JkICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoJ+ODkeOCueODr+ODvOODieOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVXNlcicpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFVzZXJJZChcbiAgbWF5YmVVc2VySWQ6IHVua25vd25cbik6IGFzc2VydHMgbWF5YmVVc2VySWQgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBtYXliZVVzZXJJZCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVXNlckVycm9yKCfjg6bjg7zjgrbjg7wgSUQg44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJywgJ0ludmFsaWRVc2VyJyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVXNlcihzdGF0ZTogdW5rbm93bik6IGFzc2VydHMgc3RhdGUgaXMgVXNlciB7XG4gIGlmICghaXNVbmtub3duUmVjb3JkKHN0YXRlKSkge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoJ+ODpuODvOOCtuODvOOBruWApOOBjOeEoeWKueOBp+OBmScsICdJbnZhbGlkVXNlcicpO1xuICB9XG5cbiAgYXNzZXJ0VmFsaWRVc2VyTmFtZShzdGF0ZS51c2VybmFtZSk7XG4gIGFzc2VydFZhbGlkUGFzc3dvcmQoc3RhdGUucGFzc3dvcmQpO1xuICBhc3NlcnRWYWxpZFRva2VuKHN0YXRlLnRva2VuKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVXNlclN0YXRlKFxuICBzdGF0ZTogdW5rbm93blxuKTogYXNzZXJ0cyBzdGF0ZSBpcyBVc2VyU3RhdGUge1xuICBhc3NlcnRWYWxpZFVzZXIoc3RhdGUpO1xuICBhc3NlcnRWYWxpZFVzZXJJZCgoc3RhdGUgYXMgdW5rbm93biBhcyBVbmtub3duUmVjb3JkKS5pZCk7XG59XG5cIi4uL3Rva2VuXCJcIi4uLy4uLy4uL3V0aWxzL3ZhbGlkYXRvclwiXCIuLi8uLi8uLi91dGlscy90eXBlc1wiIiwiaW1wb3J0IHsgYXNzZXJ0VmFsaWRVc2VyU3RhdGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdXNlci92YWxpZGF0b3InO1xuXG5pbXBvcnQgdHlwZSB7IFRhc2tTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy90YXNrJztcbmltcG9ydCB0eXBlIHsgVXNlclN0YXRlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuaW1wb3J0IHR5cGUgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYmFsU3RhdGUge1xuICB1c2VyczogVXNlclN0YXRlW107XG4gIHRhc2tzOiBUYXNrU3RhdGVbXTtcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRHbG9iYWxTdGF0ZTogR2xvYmFsU3RhdGUgPSB7XG4gIHVzZXJzOiBbXG4gICAge1xuICAgICAgdXNlcm5hbWU6ICdndWVzdCcsXG4gICAgICBwYXNzd29yZDogJ3Bhc3N3b3JkJyxcbiAgICAgIGlkOiAnR1VFU1RfSUQnLFxuICAgIH0sXG4gIF0sXG4gIHRhc2tzOiBbXSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkR2xvYmFsU3RhdGUoc3RhdGU6IFVua25vd25SZWNvcmQgfCBudWxsKTogYm9vbGVhbiB7XG4gIGlmICghc3RhdGUpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiBzdGF0ZSAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHN0YXRlLnVzZXJzKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoIUFycmF5LmlzQXJyYXkoc3RhdGUudGFza3MpKSByZXR1cm4gZmFsc2U7XG5cbiAgdHJ5IHtcbiAgICBmb3IgKGNvbnN0IHVzZXIgb2Ygc3RhdGUudXNlcnMpIHtcbiAgICAgIGFzc2VydFZhbGlkVXNlclN0YXRlKHVzZXIpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblwiLi4vZmVhdHVyZXMvdXNlci92YWxpZGF0b3JcIlwiLi4vZmVhdHVyZXMvdGFza1wiXCIuLi9mZWF0dXJlcy91c2VyXCJcIi4uLy4uL3V0aWxzL3R5cGVzXCIiLCJpbXBvcnQgeyBzZXR1cExvY2FsU3RvcmFnZSB9IGZyb20gJ34vc3RvcmUvbG9jYWxTdG9yYWdlJztcblxuaW1wb3J0IHtcbiAgdHlwZSBHbG9iYWxTdGF0ZSxcbiAgZGVmYXVsdEdsb2JhbFN0YXRlLFxuICBpc1ZhbGlkR2xvYmFsU3RhdGUsXG59IGZyb20gJy4vZ2xvYmFsU3RhdGUnO1xuXG5pbXBvcnQgdHlwZSB7IFN0b3JlIH0gZnJvbSAnfi9zdG9yZS90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVua25vd25SZWNvcmQgfSBmcm9tICd+L3V0aWxzL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBHbG9iYWxTdG9yZU9wdGlvbiB7XG4gIGluaXRpYWxTdGF0ZT86IEdsb2JhbFN0YXRlO1xuICBzdG9yZVR5cGU/OiAnbG9jYWxTdG9yYWdlJyB8ICdub3RoaW5nJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHbG9iYWxTdG9yYWdlIHtcbiAgZ2xvYmFsU3RhdGU6IEdsb2JhbFN0YXRlO1xuICB1cGRhdGVHbG9iYWxTdGF0ZTogKHN0YXRlOiBHbG9iYWxTdGF0ZSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdsb2JhbFN0b3JhZ2Uob3B0aW9uPzogR2xvYmFsU3RvcmVPcHRpb24pOiBHbG9iYWxTdG9yYWdlIHtcbiAgY29uc3Qgc3RvcmUgPSBpbml0U3RvcmUob3B0aW9uKTtcbiAgbGV0IGdsb2JhbFN0YXRlID0gc3RvcmUuZ2V0RGF0YSgpIGFzIHVua25vd24gYXMgR2xvYmFsU3RhdGU7XG5cbiAgY29uc3QgdXBkYXRlR2xvYmFsU3RhdGUgPSAoc3RhdGU6IEdsb2JhbFN0YXRlKSA9PiB7XG4gICAgc3RvcmUuc2V0RGF0YShzdGF0ZSk7XG4gICAgZ2xvYmFsU3RhdGUgPSBzdGF0ZTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGdldCBnbG9iYWxTdGF0ZSgpIHtcbiAgICAgIHJldHVybiBnbG9iYWxTdGF0ZTtcbiAgICB9LFxuICAgIHVwZGF0ZUdsb2JhbFN0YXRlLFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbml0U3RvcmUob3B0aW9uPzogR2xvYmFsU3RvcmVPcHRpb24pOiBTdG9yZTxHbG9iYWxTdGF0ZT4ge1xuICBpZiAob3B0aW9uPy5zdG9yZVR5cGUgPT09ICdub3RoaW5nJykge1xuICAgIHJldHVybiB7XG4gICAgICBnZXREYXRhOiAoKSA9PiB7XG4gICAgICAgIHJldHVybiBvcHRpb24/LmluaXRpYWxTdGF0ZSB8fCBkZWZhdWx0R2xvYmFsU3RhdGU7XG4gICAgICB9LFxuICAgICAgc2V0RGF0YTogKCkgPT4ge1xuICAgICAgICAvLyBkb24ndCBhbnl0aGluZ1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8g44GT44Gu5pmC54K544Gn44GvIEdsb2JhbFN0YXRlIOOBr+eiuuWumuOBl+OBpuOBhOOBquOBhFxuICBjb25zdCBzdG9yZSA9IHNldHVwTG9jYWxTdG9yYWdlPEdsb2JhbFN0YXRlPigpO1xuXG4gIHRyeSB7XG4gICAgaWYgKG9wdGlvbj8uaW5pdGlhbFN0YXRlKSB7XG4gICAgICBzdG9yZS5zZXREYXRhKG9wdGlvbi5pbml0aWFsU3RhdGUpO1xuICAgIH1cbiAgICBpZiAoIXN0b3JlLmdldERhdGEoKSkge1xuICAgICAgc3RvcmUuc2V0RGF0YShkZWZhdWx0R2xvYmFsU3RhdGUpO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAn5L+d5a2Y44GV44KM44Gm44GE44KL44OH44O844K/44GM5q2j44GX44GE5b2i5byP44Gn44Gv44GC44KK44G+44Gb44KTLiDjg4fjg7zjgr/jgpLliYrpmaTjgZnjgovjgYvjgIHmraPjgZfjgYTlvaLlvI/jgavkv67mraPjgZfjgabjgY/jgaDjgZXjgYQuJ1xuICAgICk7XG4gIH1cblxuICBpZiAoIWlzVmFsaWRHbG9iYWxTdGF0ZShzdG9yZS5nZXREYXRhKCkgYXMgVW5rbm93blJlY29yZCB8IG51bGwpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ+S/neWtmOOBleOCjOOBpuOBhOOCi+ODh+ODvOOCv+OBjOato+OBl+OBhOW9ouW8j+OBp+OBr+OBguOCiuOBvuOBm+OCky4g44OH44O844K/44KS5YmK6Zmk44GZ44KL44GL44CB5q2j44GX44GE5b2i5byP44Gr5L+u5q2j44GX44Gm44GP44Gg44GV44GELidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIHN0b3JlO1xufVxuXCIuLi8uLi9zdG9yZS9sb2NhbFN0b3JhZ2VcIlwiLi4vLi4vc3RvcmUvdHlwZXNcIlwiLi4vLi4vdXRpbHMvdHlwZXNcIiIsImV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaGEyNTYodGV4dDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgdWludDggPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUodGV4dCk7XG4gIGNvbnN0IGRpZ2VzdCA9IGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KCdTSEEtMjU2JywgdWludDgpO1xuXG4gIHJldHVybiBBcnJheS5mcm9tKG5ldyBVaW50OEFycmF5KGRpZ2VzdCkpXG4gICAgLm1hcCgodikgPT4gdi50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSlcbiAgICAuam9pbignJyk7XG59XG4iLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcbmltcG9ydCB7IHNoYTI1NiB9IGZyb20gJ34vdXRpbHMvc2hhMjU2JztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG50eXBlIElucHV0VGFzayA9IE9taXQ8VGFzaywgJ2lkJyB8ICdjcmVhdGVkX2F0JyB8ICdpc19jb21wbGV0ZSc+O1xuXG5pbnRlcmZhY2UgQWRkVGFza0lucHV0IHtcbiAgdGFzazogSW5wdXRUYXNrO1xuICB1c2VyOiBVc2VyU3RhdGU7XG59XG5cbmludGVyZmFjZSBBZGRUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxBZGRUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPEFkZFRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgY3JlYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICBjb25zdCBpZCA9IGF3YWl0IHNoYTI1NihgJHtpbnB1dC51c2VyfToke2NyZWF0ZWRBdH1gKTtcbiAgY29uc3QgdGFzazogVGFzayA9IHtcbiAgICAuLi5pbnB1dC50YXNrLFxuICAgIGlkLFxuICAgIGlzX2NvbXBsZXRlOiBmYWxzZSxcbiAgICBjcmVhdGVkX2F0OiBjcmVhdGVkQXQsXG4gIH07XG5cbiAgbmV3U3RhdGUudGFza3MucHVzaCh7XG4gICAgLi4udGFzayxcbiAgICB1c2VySWQ6IGlucHV0LnVzZXIuaWQsXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICAgIG91dHB1dDoge1xuICAgICAgdGFzazogdGFzayxcbiAgICB9LFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi8uLi8uLi91dGlscy9zaGEyNTZcIlwiLi4vdXNlclwiXCIuLi8uLi9nbG9iYWxTdGF0ZVwiXCIuLi8uLi90eXBlc1wiIiwiaW1wb3J0IHsgQ3VzdG9tRXJyb3IgfSBmcm9tICd+L3V0aWxzL2N1c3RvbUVycm9yJztcblxuZXhwb3J0IHR5cGUgVGFza0Vycm9yQ29kZSA9ICdJbnZhbGlkVGFzaycgfCAnVGFza05vdEZvdW5kJztcblxuZXhwb3J0IGNsYXNzIFRhc2tFcnJvciBleHRlbmRzIEN1c3RvbUVycm9yPFRhc2tFcnJvckNvZGU+IHt9XG5cIi4uLy4uLy4uL3V0aWxzL2N1c3RvbUVycm9yXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVXNlclN0YXRlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdGF0ZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZSc7XG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJ34vY29yZS90eXBlcyc7XG5cbmludGVyZmFjZSBEZWxldGVUYXNrSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBEZWxldGVUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxEZWxldGVUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPERlbGV0ZVRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcblxuICBpZiAoIXRhc2tTdGF0ZSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoYOWvvuixoeOBruOCv+OCueOCr+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn2AsICdUYXNrTm90Rm91bmQnKTtcbiAgfVxuXG4gIG5ld1N0YXRlLnRhc2tzID0gbmV3U3RhdGUudGFza3MuZmlsdGVyKFxuICAgICh0KSA9PiAhKHQudXNlcklkID09PSBpbnB1dC51c2VyLmlkICYmIHQuaWQgPT09IGlucHV0LmlkKVxuICApO1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi91c2VyXCJcIi4uLy4uL2dsb2JhbFN0YXRlXCJcIi4uLy4uL3R5cGVzXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIEdldFRhc2tzSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG59XG5cbmludGVyZmFjZSBHZXRUYXNrc1JldHVybiB7XG4gIG91dHB1dDoge1xuICAgIHRhc2tzOiBUYXNrW107XG4gIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYXNrcyhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxHZXRUYXNrc0lucHV0PlxuKTogUHJvbWlzZTxHZXRUYXNrc1JldHVybj4ge1xuICBjb25zdCB7IHN0YXRlLCBpbnB1dCB9ID0gcHJvcHM7XG4gIGNvbnN0IG5ld1N0YXRlID0gZGVlcENvcHlXaXRoV3JpdGVhYmxlKHN0YXRlKTtcblxuICBjb25zdCB0YXNrc1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmlsdGVyKCh0KSA9PiB0LnVzZXJJZCA9PT0gaW5wdXQudXNlci5pZCk7XG5cbiAgY29uc3QgdGFza3M6IFRhc2tbXSA9IHRhc2tzU3RhdGUubWFwKCh0KSA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB0LmlkLFxuICAgICAgdGl0bGU6IHQudGl0bGUsXG4gICAgICBkZXRhaWw6IHQuZGV0YWlsLFxuICAgICAgaXNfY29tcGxldGU6IHQuaXNfY29tcGxldGUsXG4gICAgICBjcmVhdGVkX2F0OiB0LmNyZWF0ZWRfYXQsXG4gICAgfTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBvdXRwdXQ6IHtcbiAgICAgIHRhc2tzLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgeyBUYXNrRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIEdldFRhc2tJbnB1dCB7XG4gIHVzZXI6IFVzZXJTdGF0ZTtcbiAgaWQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIEdldFRhc2tSZXR1cm4ge1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxHZXRUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPEdldFRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcblxuICBpZiAoIXRhc2tTdGF0ZSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoYOWvvuixoeOBruOCv+OCueOCr+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCk+OBp+OBl+OBn2AsICdUYXNrTm90Rm91bmQnKTtcbiAgfVxuXG4gIGNvbnN0IHRhc2s6IFRhc2sgPSB7XG4gICAgaWQ6IHRhc2tTdGF0ZS5pZCxcbiAgICB0aXRsZTogdGFza1N0YXRlLnRpdGxlLFxuICAgIGRldGFpbDogdGFza1N0YXRlLmRldGFpbCxcbiAgICBpc19jb21wbGV0ZTogdGFza1N0YXRlLmlzX2NvbXBsZXRlLFxuICAgIGNyZWF0ZWRfYXQ6IHRhc2tTdGF0ZS5jcmVhdGVkX2F0LFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgb3V0cHV0OiB7XG4gICAgICB0YXNrLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgeyBUYXNrRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBUYXNrIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IFVzZXJTdGF0ZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy91c2VyJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuaW1wb3J0IHR5cGUgeyBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQgfSBmcm9tICd+L2NvcmUvdHlwZXMnO1xuXG5jb25zdCBjaGFuZ2VhYmxlVGFza1BhcmFtS2V5ID0gWyd0aXRsZScsICdkZXRhaWwnXSBhcyBjb25zdDtcbnR5cGUgQ2hhbmdlYWJsZVRhc2tQYXJhbUtleSA9IHR5cGVvZiBjaGFuZ2VhYmxlVGFza1BhcmFtS2V5W251bWJlcl07XG4vLyBOT1RFOiDlpInmm7TjgZnjgovjgajjgY3jga8gdmFsaWRhdG9yIOOCguODgeOCp+ODg+OCr+OBl+OBpuOBrVxuZXhwb3J0IHR5cGUgSW5jb21pbmdQYXJ0aWFsVGFzayA9IFBhcnRpYWw8UGljazxUYXNrLCBDaGFuZ2VhYmxlVGFza1BhcmFtS2V5Pj47XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG4gIGluY29taW5nUGFydGlhbFRhc2s6IEluY29taW5nUGFydGlhbFRhc2s7XG59XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrUmV0dXJuIHtcbiAgc3RhdGU6IEdsb2JhbFN0YXRlO1xuICBvdXRwdXQ6IHtcbiAgICB0YXNrOiBUYXNrO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlVGFzayhcbiAgcHJvcHM6IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dDxVcGRhdGVUYXNrSW5wdXQ+XG4pOiBQcm9taXNlPFVwZGF0ZVRhc2tSZXR1cm4+IHtcbiAgY29uc3QgeyBzdGF0ZSwgaW5wdXQgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFza1N0YXRlID0gbmV3U3RhdGUudGFza3MuZmluZChcbiAgICAodCkgPT4gdC51c2VySWQgPT09IGlucHV0LnVzZXIuaWQgJiYgdC5pZCA9PT0gaW5wdXQuaWRcbiAgKTtcbiAgaWYgKCF0YXNrU3RhdGUpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKGDlr77osaHjga7jgr/jgrnjgq/jgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ9gLCAnVGFza05vdEZvdW5kJyk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGsgb2YgY2hhbmdlYWJsZVRhc2tQYXJhbUtleSkge1xuICAgIGNvbnN0IHYgPSBpbnB1dC5pbmNvbWluZ1BhcnRpYWxUYXNrW2tdO1xuICAgIC8vIE5PVEU6IGRldGFpbCDjga8gdW5kZWZpbmVkIOWPr+OBquOBruOBp+W8vuOBhOOBpuOBhOOBhOOBruOBiy4uLlxuICAgIGlmICh2ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhc2tTdGF0ZVtrXSA9IHY7XG4gICAgfVxuICB9XG4gIGNvbnN0IHRhc2s6IFRhc2sgPSB7XG4gICAgaWQ6IHRhc2tTdGF0ZS5pZCxcbiAgICB0aXRsZTogdGFza1N0YXRlLnRpdGxlLFxuICAgIGRldGFpbDogdGFza1N0YXRlLmRldGFpbCxcbiAgICBpc19jb21wbGV0ZTogdGFza1N0YXRlLmlzX2NvbXBsZXRlLFxuICAgIGNyZWF0ZWRfYXQ6IHRhc2tTdGF0ZS5jcmVhdGVkX2F0LFxuICB9O1xuXG4gIHJldHVybiB7XG4gICAgc3RhdGU6IG5ld1N0YXRlLFxuICAgIG91dHB1dDoge1xuICAgICAgdGFzayxcbiAgICB9LFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi91c2VyXCJcIi4uLy4uL2dsb2JhbFN0YXRlXCJcIi4uLy4uL3R5cGVzXCIiLCJpbXBvcnQgeyBkZWVwQ29weVdpdGhXcml0ZWFibGUgfSBmcm9tICd+L3V0aWxzL2RlZXBDb3B5JztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFzayB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBVc2VyU3RhdGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdXNlcic7XG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0YXRlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIFVwZGF0ZVRhc2tDb21wbGV0aW9uSW5wdXQge1xuICB1c2VyOiBVc2VyU3RhdGU7XG4gIGlkOiBzdHJpbmc7XG4gIGlzQ29tcGxldGU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBVcGRhdGVUYXNrQ29tcGxldGlvblJldHVybiB7XG4gIHN0YXRlOiBHbG9iYWxTdGF0ZTtcbiAgb3V0cHV0OiB7XG4gICAgdGFzazogVGFzaztcbiAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVRhc2tDb21wbGV0aW9uKFxuICBwcm9wczogV2l0aERCU3RhdGVSZWFkb25seUlucHV0PFVwZGF0ZVRhc2tDb21wbGV0aW9uSW5wdXQ+XG4pOiBQcm9taXNlPFVwZGF0ZVRhc2tDb21wbGV0aW9uUmV0dXJuPiB7XG4gIGNvbnN0IHsgc3RhdGUsIGlucHV0IH0gPSBwcm9wcztcbiAgY29uc3QgbmV3U3RhdGUgPSBkZWVwQ29weVdpdGhXcml0ZWFibGUoc3RhdGUpO1xuXG4gIGNvbnN0IHRhc2tTdGF0ZSA9IG5ld1N0YXRlLnRhc2tzLmZpbmQoXG4gICAgKHQpID0+IHQudXNlcklkID09PSBpbnB1dC51c2VyLmlkICYmIHQuaWQgPT09IGlucHV0LmlkXG4gICk7XG5cbiAgaWYgKCF0YXNrU3RhdGUpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKGDlr77osaHjga7jgr/jgrnjgq/jgYzopovjgaTjgYvjgorjgb7jgZvjgpPjgafjgZfjgZ9gLCAnVGFza05vdEZvdW5kJyk7XG4gIH1cblxuICB0YXNrU3RhdGUuaXNfY29tcGxldGUgPSBpbnB1dC5pc0NvbXBsZXRlO1xuICBjb25zdCB0YXNrOiBUYXNrID0ge1xuICAgIGlkOiB0YXNrU3RhdGUuaWQsXG4gICAgdGl0bGU6IHRhc2tTdGF0ZS50aXRsZSxcbiAgICBkZXRhaWw6IHRhc2tTdGF0ZS5kZXRhaWwsXG4gICAgaXNfY29tcGxldGU6IGlucHV0LmlzQ29tcGxldGUsXG4gICAgY3JlYXRlZF9hdDogdGFza1N0YXRlLmNyZWF0ZWRfYXQsXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBzdGF0ZTogbmV3U3RhdGUsXG4gICAgb3V0cHV0OiB7XG4gICAgICB0YXNrLFxuICAgIH0sXG4gIH07XG59XG5cIi4uLy4uLy4uL3V0aWxzL2RlZXBDb3B5XCJcIi4uL3VzZXJcIlwiLi4vLi4vZ2xvYmFsU3RhdGVcIlwiLi4vLi4vdHlwZXNcIiIsImltcG9ydCB7IGlzVW5rbm93blJlY29yZCB9IGZyb20gJ34vdXRpbHMvdmFsaWRhdG9yJztcblxuaW1wb3J0IHsgVGFza0Vycm9yIH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFzaywgVGFza1N0YXRlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEluY29taW5nUGFydGlhbFRhc2sgfSBmcm9tICcuL3VwZGF0ZVRhc2snO1xuaW1wb3J0IHR5cGUgeyBVbmtub3duUmVjb3JkIH0gZnJvbSAnfi91dGlscy90eXBlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tJZChcbiAgbWF5YmVUYXNrSWQ6IHVua25vd25cbik6IGFzc2VydHMgbWF5YmVUYXNrSWQgaXMgc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tJZCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKCfjgr/jgrnjgq8gSUQg44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJywgJ0ludmFsaWRUYXNrJyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza1RpdGxlKFxuICBtYXliZVRhc2tUaXRsZTogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tUaXRsZSBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIG1heWJlVGFza1RpdGxlICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+OCv+OCpOODiOODq+OBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tEZXRhaWwoXG4gIG1heWJlVGFza0RldGFpbDogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tEZXRhaWwgaXMgc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKG1heWJlVGFza0RldGFpbCA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tEZXRhaWwgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRhc2tFcnJvcign44K/44K544Kv6Kmz57Sw44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJywgJ0ludmFsaWRUYXNrJyk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza0lzQ29tcGxldGUoXG4gIG1heWJlVGFza0lzQ29tcGxldGU6IHVua25vd25cbik6IGFzc2VydHMgbWF5YmVUYXNrSXNDb21wbGV0ZSBpcyBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBtYXliZVRhc2tJc0NvbXBsZXRlICE9PSAnYm9vbGVhbicpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKFxuICAgICAgJ+OCv+OCueOCr+WujOS6huODleODqeOCsOOBjOecn+WBveWApOOBp+OBr+OBguOCiuOBvuOBm+OCkycsXG4gICAgICAnSW52YWxpZFRhc2snXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VmFsaWRUYXNrQ3JlYXRlZEF0KFxuICBtYXliZVRhc2tJc0NyZWF0ZWRBdDogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tJc0NyZWF0ZWRBdCBpcyBzdHJpbmcge1xuICBpZiAodHlwZW9mIG1heWJlVGFza0lzQ3JlYXRlZEF0ICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+S9nOaIkOaXpeaZguOBjOaWh+Wtl+WIl+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG5cbiAgaWYgKGlzTmFOKERhdGUucGFyc2UobWF5YmVUYXNrSXNDcmVhdGVkQXQpKSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoXG4gICAgICAn44K/44K544Kv5L2c5oiQ5pel5pmC44GM5pel5LuY44Gu44OV44Kp44O844Oe44OD44OI44Gn44Gv44GC44KK44G+44Gb44KTJyxcbiAgICAgICdJbnZhbGlkVGFzaydcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2tVc2VySWQoXG4gIG1heWJlVGFza0lzVXNlcklkOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlVGFza0lzVXNlcklkIGlzIHN0cmluZyB7XG4gIGlmICh0eXBlb2YgbWF5YmVUYXNrSXNVc2VySWQgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFRhc2tFcnJvcihcbiAgICAgICfjgr/jgrnjgq/jga7jg6bjg7zjgrbjg7wgSUQg44GM5paH5a2X5YiX44Gn44Gv44GC44KK44G+44Gb44KTJyxcbiAgICAgICdJbnZhbGlkVGFzaydcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRWYWxpZFRhc2soXG4gIG1heWJlVGFza1N0YXRlOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlVGFza1N0YXRlIGlzIFRhc2sge1xuICBpZiAoIWlzVW5rbm93blJlY29yZChtYXliZVRhc2tTdGF0ZSkpIHtcbiAgICB0aHJvdyBuZXcgVGFza0Vycm9yKCfjgr/jgrnjgq/jgYzjgqrjg5bjgrjjgqfjgq/jg4jlnovjgafjga/jgYLjgorjgb7jgZvjgpMnLCAnSW52YWxpZFRhc2snKTtcbiAgfVxuXG4gIGFzc2VydFZhbGlkVGFza0lkKG1heWJlVGFza1N0YXRlLmlkKTtcbiAgYXNzZXJ0VmFsaWRUYXNrVGl0bGUobWF5YmVUYXNrU3RhdGUudGl0bGUpO1xuICBpZiAoJ2RldGFpbCcgaW4gbWF5YmVUYXNrU3RhdGUpIHtcbiAgICBhc3NlcnRWYWxpZFRhc2tEZXRhaWwobWF5YmVUYXNrU3RhdGUuZGV0YWlsKTtcbiAgfVxuICBhc3NlcnRWYWxpZFRhc2tJc0NvbXBsZXRlKG1heWJlVGFza1N0YXRlLmlzX2NvbXBsZXRlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkVGFza1N0YXRlKFxuICBtYXliZVRhc2tTdGF0ZTogdW5rbm93blxuKTogYXNzZXJ0cyBtYXliZVRhc2tTdGF0ZSBpcyBUYXNrU3RhdGUge1xuICBhc3NlcnRWYWxpZFRhc2sobWF5YmVUYXNrU3RhdGUpO1xuICBhc3NlcnRWYWxpZFRhc2tVc2VySWQoKG1heWJlVGFza1N0YXRlIGFzIHVua25vd24gYXMgVW5rbm93blJlY29yZCkudXNlcklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFZhbGlkSW5jb21pbmdQYXJ0aWFsVGFzayhcbiAgbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrOiB1bmtub3duXG4pOiBhc3NlcnRzIG1heWJlSW5jb21pbmdQYXJ0aWFsVGFzayBpcyBJbmNvbWluZ1BhcnRpYWxUYXNrIHtcbiAgaWYgKCFpc1Vua25vd25SZWNvcmQobWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSkge1xuICAgIHRocm93IG5ldyBUYXNrRXJyb3IoJ+OCv+OCueOCr+OBjOOCquODluOCuOOCp+OCr+ODiOWei+OBp+OBr+OBguOCiuOBvuOBm+OCkycsICdJbnZhbGlkVGFzaycpO1xuICB9XG5cbiAgaWYgKCd0aXRsZScgaW4gbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSB7XG4gICAgYXNzZXJ0VmFsaWRUYXNrVGl0bGUobWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrLnRpdGxlKTtcbiAgfVxuICBpZiAoJ2RldGFpbCcgaW4gbWF5YmVJbmNvbWluZ1BhcnRpYWxUYXNrKSB7XG4gICAgYXNzZXJ0VmFsaWRUYXNrRGV0YWlsKG1heWJlSW5jb21pbmdQYXJ0aWFsVGFzay5kZXRhaWwpO1xuICB9XG59XG5cIi4uLy4uLy4uL3V0aWxzL3ZhbGlkYXRvclwiXCIuLi8uLi8uLi91dGlscy90eXBlc1wiIiwiaW1wb3J0IHsgdHlwZSBDb21tb25FcnJvckNvZGUsIEN1c3RvbUVycm9yIH0gZnJvbSAnfi91dGlscy9jdXN0b21FcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgVGFza0Vycm9yQ29kZSB9IGZyb20gJ34vY29yZS9mZWF0dXJlcy90YXNrL2Vycm9yJztcbmltcG9ydCB0eXBlIHsgVG9rZW5FcnJvckNvZGUgfSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdG9rZW4nO1xuaW1wb3J0IHR5cGUgeyBVc2VyRXJyb3JDb2RlIH0gZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuXG5leHBvcnQgdHlwZSBBcHBFcnJvckNvZGUgPVxuICB8IENvbW1vbkVycm9yQ29kZVxuICB8IFVzZXJFcnJvckNvZGVcbiAgfCBUb2tlbkVycm9yQ29kZVxuICB8IFRhc2tFcnJvckNvZGU7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSFRUUEVycm9yUmVzcG9uc2VCb2R5IHtcbiAgY29kZTogQXBwRXJyb3JDb2RlO1xuICBtZXNzYWdlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSFRUUEVycm9yUmVzcG9uc2Uge1xuICBzdGF0dXM6IG51bWJlcjtcbiAgYm9keTogSFRUUEVycm9yUmVzcG9uc2VCb2R5O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXJyb3IySHR0cEVycm9yUmVzcG9uc2UoZXJyb3I6IHVua25vd24pOiBIVFRQRXJyb3JSZXNwb25zZSB7XG4gIGlmICghKGVycm9yIGluc3RhbmNlb2YgQ3VzdG9tRXJyb3IpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogNTAwLFxuICAgICAgYm9keToge1xuICAgICAgICBjb2RlOiAnVW5leHBlY3RlZEVycm9yJyxcbiAgICAgICAgbWVzc2FnZTogJ+OCteODvOODkOODvOWGheOBp+S6iOacn+OBl+OBquOBhOOCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnycsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICAvLyBOT1RFOiDjgYbjgb7jgYTmlrnms5XjgYzmgJ3jgYTjgaTjgYvjgpPjgYvjgaPjgZ9cbiAgc3dpdGNoIChlcnJvci5jb2RlIGFzIEFwcEVycm9yQ29kZSkge1xuICAgIC8vIHVzZXJcbiAgICBjYXNlICdJbnZhbGlkVXNlcic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuICAgIGNhc2UgJ01pc21hdGNoZWRQYXNzd29yZCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwMSxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuICAgIGNhc2UgJ1VzZXJOb3RGb3VuZCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwNCxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuICAgIGNhc2UgJ0NvbmZsaWN0VXNlcic6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwOSxcbiAgICAgICAgYm9keTogZXJyb3IudG9Kc29uKCksXG4gICAgICB9O1xuXG4gICAgLy8gdG9rZW5cbiAgICBjYXNlICdJbnZhbGlkVG9rZW4nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdNaXNtYXRjaGVkVG9rZW4nOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDEsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdUb2tlblJlcXVpcmVkJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG5cbiAgICAvLyB0YXNrXG4gICAgY2FzZSAnSW52YWxpZFRhc2snOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcbiAgICBjYXNlICdUYXNrTm90Rm91bmQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgIGJvZHk6IGVycm9yLnRvSnNvbigpLFxuICAgICAgfTtcblxuICAgIC8vIGRlZmF1bHRcbiAgICBjYXNlICdWYWxpZGF0ZUVycm9yJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG4gICAgY2FzZSAnVW5leHBlY3RlZEVycm9yJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1czogNTAwLFxuICAgICAgICBib2R5OiBlcnJvci50b0pzb24oKSxcbiAgICAgIH07XG4gIH1cbn1cblwiLi4vLi4vdXRpbHMvY3VzdG9tRXJyb3JcIlwiLi4vLi4vY29yZS9mZWF0dXJlcy90YXNrL2Vycm9yXCJcIi4uLy4uL2NvcmUvZmVhdHVyZXMvdG9rZW5cIlwiLi4vLi4vY29yZS9mZWF0dXJlcy91c2VyXCIiLCJpbXBvcnQgeyByZXN0LCB0eXBlIERlZmF1bHRCb2R5VHlwZSwgdHlwZSBQYXRoUGFyYW1zIH0gZnJvbSAnbXN3JztcblxuaW1wb3J0ICogYXMgdGFza0ZlYXR1cmUgZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3Rhc2snO1xuaW1wb3J0ICogYXMgdG9rZW5GZWF0dXJlIGZyb20gJ34vY29yZS9mZWF0dXJlcy90b2tlbic7XG5cbmltcG9ydCB7IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlLCB0eXBlIEhUVFBFcnJvclJlc3BvbnNlQm9keSB9IGZyb20gJy4vZXJyb3InO1xuXG5pbXBvcnQgdHlwZSB7IFJlc3RIYW5kbGVyc0NyZWF0b3IgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RvcmFnZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlJztcblxuLy8gX19fX19fX19fX1xuLy8gL2FwaS90YXNrc1xuZXhwb3J0IGludGVyZmFjZSBBcGlUYXNrcyB7XG4gIGdldDoge1xuICAgIHJlc0JvZHk6IHRhc2tGZWF0dXJlLlRhc2tbXTtcbiAgfTtcbiAgcG9zdDoge1xuICAgIHJlcUJvZHk6IHtcbiAgICAgIHRpdGxlOiBzdHJpbmc7XG4gICAgICBkZXRhaWw/OiBzdHJpbmc7XG4gICAgfTtcbiAgICByZXNCb2R5OiB0YXNrRmVhdHVyZS5UYXNrO1xuICB9O1xufVxuXG5jb25zdCBjcmVhdGVUYXNrc0hhbmRsZXJzOiBSZXN0SGFuZGxlcnNDcmVhdG9yID0gKGdsb2JhbFN0b3JhZ2UpID0+IHtcbiAgcmV0dXJuIFtcbiAgICByZXN0LmdldDxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIFBhdGhQYXJhbXMsXG4gICAgICBBcGlUYXNrc1snZ2V0J11bJ3Jlc0JvZHknXSB8IEhUVFBFcnJvclJlc3BvbnNlQm9keVxuICAgID4oJy9hcGkvdGFza3MnLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGFza0ZlYXR1cmUuZ2V0VGFza3Moe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICB1c2VyLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB0YXNrcyA9IHJlc3VsdC5vdXRwdXQudGFza3M7XG5cbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCksIGN0eC5qc29uKHRhc2tzKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcblxuICAgIHJlc3QucG9zdDxcbiAgICAgIEFwaVRhc2tzWydwb3N0J11bJ3JlcUJvZHknXSxcbiAgICAgIFBhdGhQYXJhbXMsXG4gICAgICBBcGlUYXNrc1sncG9zdCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3Rhc2tzJywgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbih7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIG1heWJlQmVhcmVyVG9rZW46IHJlcS5oZWFkZXJzLmdldCgnQXV0aG9yaXphdGlvbicpLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza1RpdGxlKHJlcS5ib2R5LnRpdGxlKTtcbiAgICAgICAgdGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrRGV0YWlsKHJlcS5ib2R5LmRldGFpbCk7XG5cbiAgICAgICAgY29uc3QgaW5wdXRUYXNrID0ge1xuICAgICAgICAgIHRpdGxlOiByZXEuYm9keS50aXRsZSxcbiAgICAgICAgICBkZXRhaWw6IHJlcS5ib2R5LmRldGFpbCxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS5hZGRUYXNrKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcjogdXNlcixcbiAgICAgICAgICAgIHRhc2s6IGlucHV0VGFzayxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFzayA9IHJlc3VsdC5vdXRwdXQudGFzaztcbiAgICAgICAgZ2xvYmFsU3RvcmFnZS51cGRhdGVHbG9iYWxTdGF0ZShyZXN1bHQuc3RhdGUpO1xuXG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cygyMDApLCBjdHguanNvbih0YXNrKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdGFza3MvOnRhc2tJZFxuZXhwb3J0IGludGVyZmFjZSBBcGlUYXNrc0lkIHtcbiAgcGFyYW1zOiB7XG4gICAgdGFza0lkOiBzdHJpbmc7XG4gIH07XG4gIGdldDoge1xuICAgIHJlc0JvZHk6IHRhc2tGZWF0dXJlLlRhc2s7XG4gIH07XG4gIHBhdGNoOiB7XG4gICAgcmVxQm9keToge1xuICAgICAgdGl0bGU/OiBzdHJpbmc7XG4gICAgICBkZXRhaWw/OiBzdHJpbmc7XG4gICAgfTtcbiAgICByZXNCb2R5OiB0YXNrRmVhdHVyZS5UYXNrO1xuICB9O1xuICBkZWxldGU6IHtcbiAgICByZXNCb2R5OiB7XG4gICAgICBzdWNjZXNzOiBib29sZWFuO1xuICAgIH07XG4gIH07XG59XG5cbmNvbnN0IGNyZWF0ZVRhc2tzSWRIYW5kbGVyczogUmVzdEhhbmRsZXJzQ3JlYXRvciA9IChnbG9iYWxTdG9yYWdlKSA9PiB7XG4gIHJldHVybiBbXG4gICAgcmVzdC5nZXQ8XG4gICAgICBEZWZhdWx0Qm9keVR5cGUsXG4gICAgICBBcGlUYXNrc0lkWydwYXJhbXMnXSxcbiAgICAgIEFwaVRhc2tzSWRbJ2dldCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQnLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS5nZXRUYXNrKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFzayA9IHJlc3VsdC5vdXRwdXQudGFzaztcblxuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24odGFzaykpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG5cbiAgICByZXN0LnBhdGNoPFxuICAgICAgQXBpVGFza3NJZFsncGF0Y2gnXVsncmVxQm9keSddLFxuICAgICAgQXBpVGFza3NJZFsncGFyYW1zJ10sXG4gICAgICBBcGlUYXNrc0lkWydwYXRjaCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQnLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcbiAgICAgICAgY29uc3QgaW5jb21pbmdQYXJ0aWFsVGFzayA9IHtcbiAgICAgICAgICB0aXRsZTogcmVxLmJvZHkudGl0bGUsXG4gICAgICAgICAgZGV0YWlsOiByZXEuYm9keS5kZXRhaWwsXG4gICAgICAgIH07XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkSW5jb21pbmdQYXJ0aWFsVGFzayhpbmNvbWluZ1BhcnRpYWxUYXNrKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS51cGRhdGVUYXNrKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICAgIGluY29taW5nUGFydGlhbFRhc2ssXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhc2sgPSByZXN1bHQub3V0cHV0LnRhc2s7XG5cbiAgICAgICAgZ2xvYmFsU3RvcmFnZS51cGRhdGVHbG9iYWxTdGF0ZShyZXN1bHQuc3RhdGUpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24odGFzaykpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG5cbiAgICByZXN0LmRlbGV0ZTxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIEFwaVRhc2tzSWRbJ3BhcmFtcyddLFxuICAgICAgQXBpVGFza3NJZFsnZGVsZXRlJ11bJ3Jlc0JvZHknXSB8IEhUVFBFcnJvclJlc3BvbnNlQm9keVxuICAgID4oJy9hcGkvdGFza3MvOnRhc2tJZCcsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdG9rZW5GZWF0dXJlLmdldFVzZXJGcm9tVG9rZW4oe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgdGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrSWQocmVxLnBhcmFtcy50YXNrSWQpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRhc2tGZWF0dXJlLmRlbGV0ZVRhc2soe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICB1c2VyLFxuICAgICAgICAgICAgaWQ6IHJlcS5wYXJhbXMudGFza0lkLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0LnN0YXRlKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKDIwMCksIGN0eC5qc29uKHsgc3VjY2VzczogdHJ1ZSB9KSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdGFza3MvOnRhc2tJZC9jb21wbGV0aW9uXG5leHBvcnQgaW50ZXJmYWNlIEFwaVRhc2tzSWRDb21wbGV0aW9uIHtcbiAgcGFyYW1zOiB7XG4gICAgdGFza0lkOiBzdHJpbmc7XG4gIH07XG4gIHB1dDoge1xuICAgIHJlc0JvZHk6IHRhc2tGZWF0dXJlLlRhc2s7XG4gIH07XG4gIGRlbGV0ZToge1xuICAgIHJlc0JvZHk6IHRhc2tGZWF0dXJlLlRhc2s7XG4gIH07XG59XG5cbmNvbnN0IGNyZWF0ZVRhc2tzSWRDb21wbGV0aW9uSGFuZGxlcnM6IFJlc3RIYW5kbGVyc0NyZWF0b3IgPSAoXG4gIGdsb2JhbFN0b3JhZ2VcbikgPT4ge1xuICByZXR1cm4gW1xuICAgIHJlc3QucHV0PFxuICAgICAgRGVmYXVsdEJvZHlUeXBlLFxuICAgICAgQXBpVGFza3NJZENvbXBsZXRpb25bJ3BhcmFtcyddLFxuICAgICAgQXBpVGFza3NJZENvbXBsZXRpb25bJ3B1dCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3Rhc2tzLzp0YXNrSWQvY29tcGxldGlvbicsIGFzeW5jIChyZXEsIHJlcywgY3R4KSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdG9rZW5GZWF0dXJlLmdldFVzZXJGcm9tVG9rZW4oe1xuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgICBtYXliZUJlYXJlclRva2VuOiByZXEuaGVhZGVycy5nZXQoJ0F1dGhvcml6YXRpb24nKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgdGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrSWQocmVxLnBhcmFtcy50YXNrSWQpO1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRhc2tGZWF0dXJlLnVwZGF0ZVRhc2tDb21wbGV0aW9uKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgdXNlcixcbiAgICAgICAgICAgIGlkOiByZXEucGFyYW1zLnRhc2tJZCxcbiAgICAgICAgICAgIGlzQ29tcGxldGU6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHRhc2sgPSByZXN1bHQub3V0cHV0LnRhc2s7XG5cbiAgICAgICAgZ2xvYmFsU3RvcmFnZS51cGRhdGVHbG9iYWxTdGF0ZShyZXN1bHQuc3RhdGUpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24odGFzaykpO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZShlcnJvcik7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cyhyZXNwb25zZS5zdGF0dXMpLCBjdHguanNvbihyZXNwb25zZS5ib2R5KSk7XG4gICAgICB9XG4gICAgfSksXG5cbiAgICByZXN0LmRlbGV0ZTxcbiAgICAgIERlZmF1bHRCb2R5VHlwZSxcbiAgICAgIEFwaVRhc2tzSWRDb21wbGV0aW9uWydwYXJhbXMnXSxcbiAgICAgIEFwaVRhc2tzSWRDb21wbGV0aW9uWydkZWxldGUnXVsncmVzQm9keSddIHwgSFRUUEVycm9yUmVzcG9uc2VCb2R5XG4gICAgPignL2FwaS90YXNrcy86dGFza0lkL2NvbXBsZXRpb24nLCBhc3luYyAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRva2VuRmVhdHVyZS5nZXRVc2VyRnJvbVRva2VuKHtcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgICBpbnB1dDoge1xuICAgICAgICAgICAgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJyksXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRhc2tGZWF0dXJlLmFzc2VydFZhbGlkVGFza0lkKHJlcS5wYXJhbXMudGFza0lkKTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0YXNrRmVhdHVyZS51cGRhdGVUYXNrQ29tcGxldGlvbih7XG4gICAgICAgICAgc3RhdGU6IGdsb2JhbFN0b3JhZ2UuZ2xvYmFsU3RhdGUsXG4gICAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICAgIHVzZXIsXG4gICAgICAgICAgICBpZDogcmVxLnBhcmFtcy50YXNrSWQsXG4gICAgICAgICAgICBpc0NvbXBsZXRlOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgdGFzayA9IHJlc3VsdC5vdXRwdXQudGFzaztcblxuICAgICAgICBnbG9iYWxTdG9yYWdlLnVwZGF0ZUdsb2JhbFN0YXRlKHJlc3VsdC5zdGF0ZSk7XG4gICAgICAgIHJldHVybiByZXMoY3R4LnN0YXR1cygyMDApLCBjdHguanNvbih0YXNrKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIGNvbWJpbmVcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYXNrUmVzdEhhbmRsZXJzKGdsb2JhbFN0b3JhZ2U6IEdsb2JhbFN0b3JhZ2UpIHtcbiAgcmV0dXJuIFtcbiAgICAuLi5jcmVhdGVUYXNrc0hhbmRsZXJzKGdsb2JhbFN0b3JhZ2UpLFxuICAgIC4uLmNyZWF0ZVRhc2tzSWRIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgICAuLi5jcmVhdGVUYXNrc0lkQ29tcGxldGlvbkhhbmRsZXJzKGdsb2JhbFN0b3JhZ2UpLFxuICBdO1xufVxuXCIuLi8uLi9jb3JlL2ZlYXR1cmVzL3Rhc2tcIlwiLi4vLi4vY29yZS9mZWF0dXJlcy90b2tlblwiXCIuLi8uLi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2VcIiIsImltcG9ydCB7IEJhc2U2NCB9IGZyb20gJ2pzLWJhc2U2NCc7XG5cbmltcG9ydCB7IGRlZXBDb3B5V2l0aFdyaXRlYWJsZSB9IGZyb20gJ34vdXRpbHMvZGVlcENvcHknO1xuXG5pbXBvcnQgeyBVc2VyRXJyb3IgfSBmcm9tICcuL2Vycm9yJztcblxuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdGF0ZSB9IGZyb20gJ34vY29yZS9nbG9iYWxTdGF0ZSc7XG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJ34vY29yZS90eXBlcyc7XG5cbmludGVyZmFjZSBMb2dpblVzZXJJbnB1dCB7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBMb2dpblVzZXJSZXR1cm4ge1xuICBzdGF0ZTogR2xvYmFsU3RhdGU7XG4gIG91dHB1dHM6IHtcbiAgICB0b2tlbjogc3RyaW5nO1xuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9naW5Vc2VyKFxuICBwcm9wczogV2l0aERCU3RhdGVSZWFkb25seUlucHV0PExvZ2luVXNlcklucHV0PlxuKTogUHJvbWlzZTxMb2dpblVzZXJSZXR1cm4+IHtcbiAgY29uc3QgeyBpbnB1dCwgc3RhdGUgfSA9IHByb3BzO1xuICBjb25zdCBuZXdTdGF0ZSA9IGRlZXBDb3B5V2l0aFdyaXRlYWJsZShzdGF0ZSk7XG5cbiAgY29uc3QgdGFyZ2V0VXNlciA9IHN0YXRlLnVzZXJzLmZpbmQoKHUpID0+IHUudXNlcm5hbWUgPT09IGlucHV0LnVzZXJuYW1lKTtcbiAgaWYgKCF0YXJnZXRVc2VyKSB7XG4gICAgdGhyb3cgbmV3IFVzZXJFcnJvcihcbiAgICAgIGDjg6bjg7zjgrbjg7wgJHtpbnB1dC51c2VybmFtZX0g44GM5a2Y5Zyo44GX44G+44Gb44KTYCxcbiAgICAgICdVc2VyTm90Rm91bmQnXG4gICAgKTtcbiAgfVxuXG4gIGlmICh0YXJnZXRVc2VyLnBhc3N3b3JkICE9PSBpbnB1dC5wYXNzd29yZCkge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoXG4gICAgICBg44Om44O844K244O8ICR7aW5wdXQudXNlcm5hbWV9IOOBr+imi+OBpOOBi+OCiuOBvuOBl+OBn+OBjOOAgeODkeOCueODr+ODvOODiSAke2lucHV0LnBhc3N3b3JkfSDjgYzmraPjgZfjgY/jgYLjgorjgb7jgZvjgpNgLFxuICAgICAgJ01pc21hdGNoZWRQYXNzd29yZCdcbiAgICApO1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBCYXNlNjQuZW5jb2RlKFxuICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIHVzZXI6IGlucHV0LnVzZXJuYW1lLFxuICAgICAgZGF0ZTogbmV3IERhdGUoKSxcbiAgICB9KVxuICApO1xuICBuZXdTdGF0ZS51c2Vycy5mb3JFYWNoKCh1c2VyKSA9PiB7XG4gICAgaWYgKHVzZXIudXNlcm5hbWUgPT09IGlucHV0LnVzZXJuYW1lKSB7XG4gICAgICB1c2VyLnRva2VuID0gdG9rZW47XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHN0YXRlOiBuZXdTdGF0ZSxcbiAgICBvdXRwdXRzOiB7XG4gICAgICB0b2tlbixcbiAgICB9LFxuICB9O1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi8uLi9nbG9iYWxTdGF0ZVwiXCIuLi8uLi90eXBlc1wiIiwiaW1wb3J0IHsgZGVlcENvcHlXaXRoV3JpdGVhYmxlIH0gZnJvbSAnfi91dGlscy9kZWVwQ29weSc7XG5cbmltcG9ydCB0eXBlIHsgVXNlclN0YXRlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0YXRlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlJztcbmltcG9ydCB0eXBlIHsgV2l0aERCU3RhdGVSZWFkb25seUlucHV0IH0gZnJvbSAnfi9jb3JlL3R5cGVzJztcblxuaW50ZXJmYWNlIExvZ291dFVzZXJJbnB1dCB7XG4gIHVzZXI6IFVzZXJTdGF0ZTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ291dFVzZXIoXG4gIHByb3BzOiBXaXRoREJTdGF0ZVJlYWRvbmx5SW5wdXQ8TG9nb3V0VXNlcklucHV0PlxuKTogUHJvbWlzZTxHbG9iYWxTdGF0ZT4ge1xuICBjb25zdCB7IHN0YXRlLCBpbnB1dCB9ID0gcHJvcHM7XG4gIGNvbnN0IG5ld1N0YXRlID0gZGVlcENvcHlXaXRoV3JpdGVhYmxlKHN0YXRlKTtcblxuICBuZXdTdGF0ZS51c2Vycy5mb3JFYWNoKCh1c2VyKSA9PiB7XG4gICAgaWYgKHVzZXIuaWQgPT09IGlucHV0LnVzZXIuaWQpIHtcbiAgICAgIGRlbGV0ZSB1c2VyLnRva2VuO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG5ld1N0YXRlO1xufVxuXCIuLi8uLi8uLi91dGlscy9kZWVwQ29weVwiXCIuLi8uLi9nbG9iYWxTdGF0ZVwiXCIuLi8uLi90eXBlc1wiIiwiaW1wb3J0IHsgZGVlcENvcHlXaXRoV3JpdGVhYmxlIH0gZnJvbSAnfi91dGlscy9kZWVwQ29weSc7XG5pbXBvcnQgeyBzaGEyNTYgfSBmcm9tICd+L3V0aWxzL3NoYTI1Nic7XG5cbmltcG9ydCB7IFVzZXJFcnJvciB9IGZyb20gJy4vZXJyb3InO1xuXG5pbXBvcnQgdHlwZSB7IFdpdGhEQlN0YXRlUmVhZG9ubHlJbnB1dCB9IGZyb20gJy4uLy4uL3R5cGVzJztcbmltcG9ydCB0eXBlIHsgR2xvYmFsU3RhdGUgfSBmcm9tICd+L2NvcmUvZ2xvYmFsU3RhdGUnO1xuXG5pbnRlcmZhY2UgUmVnaXN0ZXJVc2VySW5wdXQge1xuICB1c2VybmFtZTogc3RyaW5nO1xuICBwYXNzd29yZDogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVnaXN0ZXJVc2VyKFxuICBwcm9wczogV2l0aERCU3RhdGVSZWFkb25seUlucHV0PFJlZ2lzdGVyVXNlcklucHV0PlxuKTogUHJvbWlzZTxHbG9iYWxTdGF0ZT4ge1xuICBjb25zdCB7IGlucHV0LCBzdGF0ZSB9ID0gcHJvcHM7XG4gIGNvbnN0IG5ld1N0YXRlID0gZGVlcENvcHlXaXRoV3JpdGVhYmxlKHN0YXRlKTtcblxuICBpZiAoc3RhdGUudXNlcnMuZmlsdGVyKCh1KSA9PiB1LnVzZXJuYW1lID09PSBpbnB1dC51c2VybmFtZSkubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBVc2VyRXJyb3IoXG4gICAgICBg44Om44O844K244O8ICR7aW5wdXQudXNlcm5hbWV9IOOBr+aXouOBq+eZu+mMsuOBleOCjOOBpuOBhOOBvuOBmWAsXG4gICAgICAnQ29uZmxpY3RVc2VyJ1xuICAgICk7XG4gIH1cblxuICBjb25zdCBpZCA9IGF3YWl0IHNoYTI1NihpbnB1dC51c2VybmFtZSk7XG4gIG5ld1N0YXRlLnVzZXJzLnB1c2goe1xuICAgIHVzZXJuYW1lOiBpbnB1dC51c2VybmFtZSxcbiAgICBwYXNzd29yZDogaW5wdXQucGFzc3dvcmQsXG4gICAgaWQsXG4gIH0pO1xuXG4gIHJldHVybiBuZXdTdGF0ZTtcbn1cblwiLi4vLi4vLi4vdXRpbHMvZGVlcENvcHlcIlwiLi4vLi4vLi4vdXRpbHMvc2hhMjU2XCJcIi4uLy4uL2dsb2JhbFN0YXRlXCIiLCJpbXBvcnQgeyB0eXBlIFBhdGhQYXJhbXMsIHJlc3QsIERlZmF1bHRCb2R5VHlwZSB9IGZyb20gJ21zdyc7XG5cbmltcG9ydCAqIGFzIHRva2VuRmVhdHVyZSBmcm9tICd+L2NvcmUvZmVhdHVyZXMvdG9rZW4nO1xuaW1wb3J0ICogYXMgdXNlckZlYXR1cmUgZnJvbSAnfi9jb3JlL2ZlYXR1cmVzL3VzZXInO1xuXG5pbXBvcnQgeyBlcnJvcjJIdHRwRXJyb3JSZXNwb25zZSwgSFRUUEVycm9yUmVzcG9uc2VCb2R5IH0gZnJvbSAnLi9lcnJvcic7XG5cbmltcG9ydCB0eXBlIHsgUmVzdEhhbmRsZXJzQ3JlYXRvciB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdG9yYWdlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2UnO1xuXG4vLyBfX19fX19fX19fXG4vLyAvYXBpL3VzZXJzL3JlZ2lzdGVyXG5leHBvcnQgaW50ZXJmYWNlIEFwaVVzZXJzUmVnaXN0ZXIge1xuICBwb3N0OiB7XG4gICAgcmVxQm9keToge1xuICAgICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfTtcbiAgICByZXNCb2R5OiB7XG4gICAgICBzdWNjZXNzOiBib29sZWFuO1xuICAgIH07XG4gIH07XG59XG5cbmNvbnN0IGNyZWF0ZVVzZXJzUmVnaXN0ZXJIYW5kbGVyczogUmVzdEhhbmRsZXJzQ3JlYXRvciA9IChnbG9iYWxTdG9yYWdlKSA9PiB7XG4gIHJldHVybiBbXG4gICAgcmVzdC5wb3N0PFxuICAgICAgQXBpVXNlcnNSZWdpc3RlclsncG9zdCddWydyZXFCb2R5J10sXG4gICAgICBQYXRoUGFyYW1zLFxuICAgICAgQXBpVXNlcnNSZWdpc3RlclsncG9zdCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3VzZXJzL3JlZ2lzdGVyJywgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHVzZXJGZWF0dXJlLmFzc2VydFZhbGlkVXNlck5hbWUocmVxLmJvZHkudXNlcm5hbWUpO1xuICAgICAgICB1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFBhc3N3b3JkKHJlcS5ib2R5LnBhc3N3b3JkKTtcbiAgICAgICAgY29uc3QgdXNlckluZm8gPSB7XG4gICAgICAgICAgdXNlcm5hbWU6IHJlcS5ib2R5LnVzZXJuYW1lLFxuICAgICAgICAgIHBhc3N3b3JkOiByZXEuYm9keS5wYXNzd29yZCxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyRmVhdHVyZS5yZWdpc3RlclVzZXIoe1xuICAgICAgICAgIGlucHV0OiB1c2VySW5mbyxcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0KTtcblxuICAgICAgICByZXR1cm4gcmVzKFxuICAgICAgICAgIGN0eC5zdGF0dXMoMjAwKSxcbiAgICAgICAgICBjdHguanNvbih7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdXNlcnMvbG9naW5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpVXNlcnNMb2dpbiB7XG4gIHBvc3Q6IHtcbiAgICByZXFCb2R5OiB7XG4gICAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9O1xuICAgIHJlc0JvZHk6IHtcbiAgICAgIHN1Y2Nlc3M6IHRydWU7XG4gICAgICB0b2tlbjogc3RyaW5nO1xuICAgIH07XG4gIH07XG59XG5cbmNvbnN0IGNyZWF0ZVVzZXJzTG9naW5IYW5kbGVyczogUmVzdEhhbmRsZXJzQ3JlYXRvciA9IChnbG9iYWxTdG9yYWdlKSA9PiB7XG4gIHJldHVybiBbXG4gICAgcmVzdC5wb3N0PFxuICAgICAgQXBpVXNlcnNMb2dpblsncG9zdCddWydyZXFCb2R5J10sXG4gICAgICBQYXRoUGFyYW1zLFxuICAgICAgQXBpVXNlcnNMb2dpblsncG9zdCddWydyZXNCb2R5J10gfCBIVFRQRXJyb3JSZXNwb25zZUJvZHlcbiAgICA+KCcvYXBpL3VzZXJzL2xvZ2luJywgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHVzZXJGZWF0dXJlLmFzc2VydFZhbGlkVXNlck5hbWUocmVxLmJvZHkudXNlcm5hbWUpO1xuICAgICAgICB1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFBhc3N3b3JkKHJlcS5ib2R5LnBhc3N3b3JkKTtcbiAgICAgICAgY29uc3QgdXNlckluZm8gPSB7XG4gICAgICAgICAgdXNlcm5hbWU6IHJlcS5ib2R5LnVzZXJuYW1lLFxuICAgICAgICAgIHBhc3N3b3JkOiByZXEuYm9keS5wYXNzd29yZCxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1c2VyRmVhdHVyZS5sb2dpblVzZXIoe1xuICAgICAgICAgIGlucHV0OiB1c2VySW5mbyxcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgfSk7XG4gICAgICAgIGdsb2JhbFN0b3JhZ2UudXBkYXRlR2xvYmFsU3RhdGUocmVzdWx0LnN0YXRlKTtcblxuICAgICAgICByZXR1cm4gcmVzKFxuICAgICAgICAgIGN0eC5zdGF0dXMoMjAwKSxcbiAgICAgICAgICBjdHguanNvbih7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgdG9rZW46IHJlc3VsdC5vdXRwdXRzLnRva2VuLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IGVycm9yMkh0dHBFcnJvclJlc3BvbnNlKGVycm9yKTtcbiAgICAgICAgcmV0dXJuIHJlcyhjdHguc3RhdHVzKHJlc3BvbnNlLnN0YXR1cyksIGN0eC5qc29uKHJlc3BvbnNlLmJvZHkpKTtcbiAgICAgIH1cbiAgICB9KSxcbiAgXTtcbn07XG5cbi8vIF9fX19fX19fX19cbi8vIC9hcGkvdXNlcnMvbG9nb3V0XG5leHBvcnQgaW50ZXJmYWNlIEFwaVVzZXJzTG9nb3V0IHtcbiAgcG9zdDoge1xuICAgIHJlcUhlYWRlcnM6IHtcbiAgICAgIEF1dGhvcml6YXRpb246IHN0cmluZztcbiAgICB9O1xuICAgIHJlc0JvZHk6IHtcbiAgICAgIHN1Y2Nlc3M6IGJvb2xlYW47XG4gICAgfTtcbiAgfTtcbn1cblxuY29uc3QgY3JlYXRlVXNlcnNMb2dvdXRIYW5kbGVyczogUmVzdEhhbmRsZXJzQ3JlYXRvciA9IChnbG9iYWxTdG9yYWdlKSA9PiB7XG4gIHJldHVybiBbXG4gICAgcmVzdC5wb3N0PFxuICAgICAgRGVmYXVsdEJvZHlUeXBlLFxuICAgICAgUGF0aFBhcmFtcyxcbiAgICAgIEFwaVVzZXJzTG9nb3V0Wydwb3N0J11bJ3Jlc0JvZHknXSB8IEhUVFBFcnJvclJlc3BvbnNlQm9keVxuICAgID4oJy9hcGkvdXNlcnMvbG9nb3V0JywgYXN5bmMgKHJlcSwgcmVzLCBjdHgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbih7XG4gICAgICAgICAgaW5wdXQ6IHsgbWF5YmVCZWFyZXJUb2tlbjogcmVxLmhlYWRlcnMuZ2V0KCdBdXRob3JpemF0aW9uJykgfSxcbiAgICAgICAgICBzdGF0ZTogZ2xvYmFsU3RvcmFnZS5nbG9iYWxTdGF0ZSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXNlckZlYXR1cmUubG9nb3V0VXNlcih7XG4gICAgICAgICAgaW5wdXQ6IHsgdXNlciB9LFxuICAgICAgICAgIHN0YXRlOiBnbG9iYWxTdG9yYWdlLmdsb2JhbFN0YXRlLFxuICAgICAgICB9KTtcbiAgICAgICAgZ2xvYmFsU3RvcmFnZS51cGRhdGVHbG9iYWxTdGF0ZShyZXN1bHQpO1xuXG4gICAgICAgIHJldHVybiByZXMoXG4gICAgICAgICAgY3R4LnN0YXR1cygyMDApLFxuICAgICAgICAgIGN0eC5qc29uKHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gZXJyb3IySHR0cEVycm9yUmVzcG9uc2UoZXJyb3IpO1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSwgY3R4Lmpzb24ocmVzcG9uc2UuYm9keSkpO1xuICAgICAgfVxuICAgIH0pLFxuICBdO1xufTtcblxuLy8gX19fX19fX19fX1xuLy8gY29tYmluZVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVVzZXJSZXN0SGFuZGxlcnMoZ2xvYmFsU3RvcmFnZTogR2xvYmFsU3RvcmFnZSkge1xuICByZXR1cm4gW1xuICAgIC4uLmNyZWF0ZVVzZXJzUmVnaXN0ZXJIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgICAuLi5jcmVhdGVVc2Vyc0xvZ2luSGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gICAgLi4uY3JlYXRlVXNlcnNMb2dvdXRIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgXTtcbn1cblwiLi4vLi4vY29yZS9mZWF0dXJlcy90b2tlblwiXCIuLi8uLi9jb3JlL2ZlYXR1cmVzL3VzZXJcIlwiLi4vLi4vY29yZS9nbG9iYWxTdGF0ZS9nbG9iYWxTdG9yYWdlXCIiLCJpbXBvcnQgeyByZXN0LCB0eXBlIERlZmF1bHRCb2R5VHlwZSwgdHlwZSBQYXRoUGFyYW1zIH0gZnJvbSAnbXN3JztcblxuaW1wb3J0IHsgY3JlYXRlVGFza1Jlc3RIYW5kbGVycyB9IGZyb20gJy4vdGFza1Jlc3RIYW5kbGVycyc7XG5pbXBvcnQgeyBjcmVhdGVVc2VyUmVzdEhhbmRsZXJzIH0gZnJvbSAnLi91c2VyUmVzdEhhbmRsZXJzJztcblxuaW1wb3J0IHR5cGUgeyBHbG9iYWxTdG9yYWdlIH0gZnJvbSAnfi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwaUhlYWx0aCB7XG4gIGdldDoge1xuICAgIHJlc0JvZHk6IHtcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICB9O1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVzdEhhbmRsZXJzKGdsb2JhbFN0b3JhZ2U6IEdsb2JhbFN0b3JhZ2UpIHtcbiAgY29uc3QgcmVzdEhhbmRsZXJzID0gW1xuICAgIHJlc3QuZ2V0PERlZmF1bHRCb2R5VHlwZSwgUGF0aFBhcmFtcywgQXBpSGVhbHRoWydnZXQnXVsncmVzQm9keSddPihcbiAgICAgICcvYXBpL2hlYWx0aCcsXG4gICAgICAocmVxLCByZXMsIGN0eCkgPT4ge1xuICAgICAgICByZXR1cm4gcmVzKGN0eC5zdGF0dXMoMjAwKSwgY3R4Lmpzb24oeyBtZXNzYWdlOiBcIkknbSBoZWFsdGh5IVwiIH0pKTtcbiAgICAgIH1cbiAgICApLFxuICAgIC4uLmNyZWF0ZVVzZXJSZXN0SGFuZGxlcnMoZ2xvYmFsU3RvcmFnZSksXG4gICAgLi4uY3JlYXRlVGFza1Jlc3RIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSxcbiAgXTtcblxuICByZXR1cm4gcmVzdEhhbmRsZXJzO1xufVxuXCIuLi8uLi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2VcIiIsImltcG9ydCB7IHNldHVwV29ya2VyIH0gZnJvbSAnbXN3JztcblxuaW1wb3J0IHsgY3JlYXRlR2xvYmFsU3RvcmFnZSB9IGZyb20gJy4vY29yZS9nbG9iYWxTdGF0ZSc7XG5pbXBvcnQgeyBjcmVhdGVSZXN0SGFuZGxlcnMgfSBmcm9tICcuL2hhbmRsZXJzL3Jlc3QnO1xuXG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0b3JlT3B0aW9uIH0gZnJvbSAnLi9jb3JlL2dsb2JhbFN0YXRlL2dsb2JhbFN0b3JhZ2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdvcmtlck9wdGlvbiBleHRlbmRzIEdsb2JhbFN0b3JlT3B0aW9uIHtcbiAgdHlwZT86ICdyZXN0Jztcbn1cblxuZXhwb3J0IGNvbnN0IHN0YXJ0V29ya2VyID0gKG9wdGlvbj86IFdvcmtlck9wdGlvbikgPT4ge1xuICBjb25zdCBnbG9iYWxTdG9yYWdlID0gY3JlYXRlR2xvYmFsU3RvcmFnZShvcHRpb24pO1xuXG4gIGNvbnN0IHdvcmtlciA9IHNldHVwV29ya2VyKC4uLmNyZWF0ZVJlc3RIYW5kbGVycyhnbG9iYWxTdG9yYWdlKSk7XG5cbiAgd29ya2VyLnN0YXJ0KCk7XG59O1xuIiwiaW1wb3J0IHR5cGUge1xuICBBcGlIZWFsdGgsXG4gIEFwaVRhc2tzLFxuICBBcGlVc2Vyc1JlZ2lzdGVyLFxuICBBcGlVc2Vyc0xvZ2luLFxuICBBcGlVc2Vyc0xvZ291dCxcbiAgSFRUUEVycm9yUmVzcG9uc2VCb2R5LFxuICBBcGlUYXNrc0lkLFxuICBBcGlUYXNrc0lkQ29tcGxldGlvbixcbn0gZnJvbSAnfi9oYW5kbGVycy9yZXN0JztcblxuZXhwb3J0IHR5cGUgQXBpUmVzcG9uc2U8U3VjY2Vzc1Jlc3BvbnNlQm9keT4gPSBQcm9taXNlPFxuICB8IHtcbiAgICAgIG9rOiBmYWxzZTtcbiAgICAgIGJvZHk6IEhUVFBFcnJvclJlc3BvbnNlQm9keTtcbiAgICB9XG4gIHwge1xuICAgICAgb2s6IHRydWU7XG4gICAgICBib2R5OiBTdWNjZXNzUmVzcG9uc2VCb2R5O1xuICAgIH1cbj47XG5cbmV4cG9ydCBjb25zdCByZXN0QXBpID0ge1xuICBoZWFsdGg6IHtcbiAgICBnZXQ6IGFzeW5jICgpOiBBcGlSZXNwb25zZTxBcGlIZWFsdGhbJ2dldCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL2hlYWx0aCcpO1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgIGJvZHksXG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG5cbiAgdXNlcnM6IHtcbiAgICByZWdpc3Rlcjoge1xuICAgICAgcG9zdDogYXN5bmMgKFxuICAgICAgICBwYXlsb2FkOiBBcGlVc2Vyc1JlZ2lzdGVyWydwb3N0J11bJ3JlcUJvZHknXVxuICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVXNlcnNSZWdpc3RlclsncG9zdCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdXNlcnMvcmVnaXN0ZXInLCB7XG4gICAgICAgICAgbWV0aG9kOiAncG9zdCcsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHBheWxvYWQpLFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogcmVzLm9rLFxuICAgICAgICAgIGJvZHksXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0sXG4gICAgbG9naW46IHtcbiAgICAgIHBvc3Q6IGFzeW5jIChcbiAgICAgICAgcGF5bG9hZDogQXBpVXNlcnNMb2dpblsncG9zdCddWydyZXFCb2R5J11cbiAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVVzZXJzTG9naW5bJ3Bvc3QnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL3VzZXJzL2xvZ2luJywge1xuICAgICAgICAgIG1ldGhvZDogJ3Bvc3QnLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICBib2R5LFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9LFxuICAgIGxvZ291dDoge1xuICAgICAgcG9zdDogYXN5bmMgKFxuICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICApOiBBcGlSZXNwb25zZTxBcGlVc2Vyc0xvZ291dFsncG9zdCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdXNlcnMvbG9nb3V0Jywge1xuICAgICAgICAgIG1ldGhvZDogJ3Bvc3QnLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgICAgYm9keSxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcblxuICB0YXNrczoge1xuICAgIGdldDogYXN5bmMgKHRva2VuOiBzdHJpbmcpOiBBcGlSZXNwb25zZTxBcGlUYXNrc1snZ2V0J11bJ3Jlc0JvZHknXT4gPT4ge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdGFza3MnLCB7XG4gICAgICAgIG1ldGhvZDogJ2dldCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgIGJvZHksXG4gICAgICB9O1xuICAgIH0sXG4gICAgcG9zdDogYXN5bmMgKFxuICAgICAgcGF5bG9hZDogQXBpVGFza3NbJ3Bvc3QnXVsncmVxQm9keSddLFxuICAgICAgdG9rZW46IHN0cmluZ1xuICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzWydwb3N0J11bJ3Jlc0JvZHknXT4gPT4ge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvdGFza3MnLCB7XG4gICAgICAgIG1ldGhvZDogJ3Bvc3QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBvazogcmVzLm9rLFxuICAgICAgICBib2R5LFxuICAgICAgfTtcbiAgICB9LFxuICAgIF90YXNrSWQ6ICh0YXNrSWQ6IHN0cmluZykgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZ2V0OiBhc3luYyAoXG4gICAgICAgICAgdG9rZW46IHN0cmluZ1xuICAgICAgICApOiBBcGlSZXNwb25zZTxBcGlUYXNrc0lkWydnZXQnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdGFza3MvJHt0YXNrSWR9YCwge1xuICAgICAgICAgICAgbWV0aG9kOiAnZ2V0JyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9rOiByZXMub2ssXG4gICAgICAgICAgICBib2R5LFxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIHBhdGNoOiBhc3luYyAoXG4gICAgICAgICAgcGF5bG9hZDogQXBpVGFza3NJZFsncGF0Y2gnXVsncmVxQm9keSddLFxuICAgICAgICAgIHRva2VuOiBzdHJpbmdcbiAgICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVGFza3NJZFsncGF0Y2gnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdGFza3MvJHt0YXNrSWR9YCwge1xuICAgICAgICAgICAgbWV0aG9kOiAncGF0Y2gnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBvazogcmVzLm9rLFxuICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IGFzeW5jIChcbiAgICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzSWRbJ2RlbGV0ZSddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH1gLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdkZWxldGUnLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcy5qc29uKCk7XG5cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICAgIGJvZHksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcblxuICAgICAgICBjb21wbGV0aW9uOiB7XG4gICAgICAgICAgcHV0OiBhc3luYyAoXG4gICAgICAgICAgICB0b2tlbjogc3RyaW5nXG4gICAgICAgICAgKTogQXBpUmVzcG9uc2U8QXBpVGFza3NJZENvbXBsZXRpb25bJ3B1dCddWydyZXNCb2R5J10+ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL3Rhc2tzLyR7dGFza0lkfS9jb21wbGV0aW9uYCwge1xuICAgICAgICAgICAgICBtZXRob2Q6ICdwdXQnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBvazogcmVzLm9rLFxuICAgICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGRlbGV0ZTogYXN5bmMgKFxuICAgICAgICAgICAgdG9rZW46IHN0cmluZ1xuICAgICAgICAgICk6IEFwaVJlc3BvbnNlPEFwaVRhc2tzSWRDb21wbGV0aW9uWydkZWxldGUnXVsncmVzQm9keSddPiA9PiB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH0vY29tcGxldGlvbmAsIHtcbiAgICAgICAgICAgICAgbWV0aG9kOiAnZGVsZXRlJyxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVzLmpzb24oKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgb2s6IHJlcy5vayxcbiAgICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbn07XG5cIi4uL2hhbmRsZXJzL3Jlc3RcIiJdLCJuYW1lcyI6WyJ0b2tlbkZlYXR1cmUuZ2V0VXNlckZyb21Ub2tlbiIsInRhc2tGZWF0dXJlLmdldFRhc2tzIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrVGl0bGUiLCJ0YXNrRmVhdHVyZS5hc3NlcnRWYWxpZFRhc2tEZXRhaWwiLCJ0YXNrRmVhdHVyZS5hZGRUYXNrIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRUYXNrSWQiLCJ0YXNrRmVhdHVyZS5nZXRUYXNrIiwidGFza0ZlYXR1cmUuYXNzZXJ0VmFsaWRJbmNvbWluZ1BhcnRpYWxUYXNrIiwidGFza0ZlYXR1cmUudXBkYXRlVGFzayIsInRhc2tGZWF0dXJlLmRlbGV0ZVRhc2siLCJ0YXNrRmVhdHVyZS51cGRhdGVUYXNrQ29tcGxldGlvbiIsInVzZXJGZWF0dXJlLmFzc2VydFZhbGlkVXNlck5hbWUiLCJ1c2VyRmVhdHVyZS5hc3NlcnRWYWxpZFBhc3N3b3JkIiwidXNlckZlYXR1cmUucmVnaXN0ZXJVc2VyIiwidXNlckZlYXR1cmUubG9naW5Vc2VyIiwidXNlckZlYXR1cmUubG9nb3V0VXNlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7U0FFZ0IsaUJBQWlCLEdBQUE7SUFDL0IsTUFBTSxpQkFBaUIsR0FBRywyQkFBMkIsQ0FBQztBQUV0RCxJQUFBLE1BQU0sS0FBSyxHQUFhO1FBQ3RCLE9BQU8s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
