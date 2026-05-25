import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SITE = 'tzzb.10jqka.com.cn';

// 账户配置文件路径
const ACCOUNT_CONFIG_PATH = path.join(os.homedir(), '.opencli', 'profiles', 'default', 'tzzb', 'account.json');

// 读取保存的账户 ID
function getSavedAccountId() {
    try {
        if (fs.existsSync(ACCOUNT_CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(ACCOUNT_CONFIG_PATH, 'utf8'));
            return config.accountId;
        }
    } catch (e) {
        // 配置文件读取失败，忽略
    }
    return null;
}

// 保存账户 ID
function saveAccountId(accountId) {
    try {
        const dir = path.dirname(ACCOUNT_CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(ACCOUNT_CONFIG_PATH, JSON.stringify({ accountId, savedAt: new Date().toISOString() }, null, 2));
        console.log(`✅ 账户 ID 已保存: ${accountId}`);
    } catch (e) {
        console.log(`⚠️ 账户 ID 保存失败: ${e.message}`);
    }
}

// 从 URL 中提取账户 ID
function extractAccountId(url) {
    const match = url.match(/\/myAccount\/a\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// 构建导航 URL
function buildNavigateUrl() {
    const accountId = getSavedAccountId();
    if (accountId) {
        return `https://tzzb.10jqka.com.cn/pc/index.html#/myAccount/a/${accountId}`;
    }
    return 'https://tzzb.10jqka.com.cn/pc/index.html#/myAccount';
}

// 格式化数字：保留两位小数，保留正负号
const fmtNum = (s) => {
    if (!s || s === '--') return '--';
    const clean = s.replace(/[+%]/g, '');
    const n = parseFloat(clean);
    if (isNaN(n)) return s;
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}`;
};

// 格式化无符号数字（用于市值、价格）
const fmtNumRaw = (s) => {
    if (!s || s === '--') return '--';
    const clean = s.replace(/[+%]/g, '');
    const n = parseFloat(clean);
    if (isNaN(n)) return s;
    return n.toFixed(2);
};

// 合并盈亏：金额(率)
const mergeProfit = (profit, rate) => {
    const p = fmtNum(profit);
    const r = rate || '--';
    if (p === '--') return '--';
    return `${p}(${r})`;
};

// 动态列配置（会被函数修改）
let dynamicColumns = [
    '代码', '名称', '市值', '当日盈亏', '持有盈亏',
    '仓位占比', '持仓数', '持有天数', '成本/现价'
];

// 字段映射：英文标识 -> {中文列名, 提取函数}
const fieldDefs = {
    'code':  { label: '代码',   extract: (r) => r[0] },
    'name':  { label: '名称',   extract: (r) => r[1] },
    'value': { label: '持仓市值', extract: (r) => fmtNumRaw(r[2]) },
    'dp':    { label: '当日盈亏', extract: (r) => fmtNum(r[3]) },
    'dpr':   { label: '当日盈亏率', extract: (r) => r[4] || '--' },
    'hp':    { label: '持有盈亏', extract: (r) => fmtNum(r[5]) },
    'hpr':   { label: '持有盈亏率', extract: (r) => r[6] || '--' },
    'hd':    { label: '持仓天数', extract: (r) => r[14] || '--' },
    'hr':    { label: '持仓比例', extract: (r) => r[12] || '--' },
    'cost':  { label: '成本',   extract: (r) => fmtNumRaw(r[18]) },
    'price': { label: '现价',   extract: (r) => fmtNumRaw(r[17]) },
};

cli({
    site: 'tzzb',
    name: 'pos',
    description: '获取持仓汇总：股票代码、名称、市值、当日盈亏(率)、持有盈亏(率)、仓位占比、持仓数、持有天数、成本/现价。默认输出：代码、名称、当日盈亏、当日盈亏率、持仓市值、持仓比例。其余字段可通过 --data 参数配置。首次使用需登录，账户 ID 会自动保存。',
    access: 'read',
    example: 'opencli tzzb pos [--sortby value] [--sort des] [--data code,name,dp,dpr,value,hr]',
    domain: SITE,
    strategy: Strategy.COOKIE,
    browser: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    navigateBefore: buildNavigateUrl(),
    siteSession: 'persistent',
    defaultFormat: 'md',
    args: [
        { name: 'sortby', type: 'str', default: 'dayprofit', help: '排序字段：value(市值)、dayprofit(当日盈亏)、holdprofit(持有盈亏)、holddays(持有天数)' },
        { name: 'sort', type: 'str', default: 'des', help: '排序方向：asc(升序)、des(降序)' },
        {
            name: 'data',
            type: 'str',
            default: 'code,name,dp,dpr,value,hr',
            help: '输出字段（逗号分隔）：code(代码)、name(名称)、value(持仓市值)、dp(当日盈亏)、dpr(当日盈亏率)、hp(持有盈亏)、hpr(持有盈亏率)、hd(持有天数)、hr(仓位占比)、cost(成本)、price(现价)。默认输出：code,name,dp,dpr,value,hr'
        },
        { name: 'refresh', type: 'bool', default: false, help: '查询前刷新页面以获取最新数据' },
    ],
    columns: dynamicColumns,
    func: async (page, args) => {
        // 如果指定了 --refresh，先刷新页面
        if (args.refresh) {
            console.log('刷新页面以获取最新数据...');
            await page.evaluate(() => location.reload());
            // 在页面上下文中等待
            await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
        }
        
        const sortby = args.sortby || 'dayprofit';
        const sortDir = args.sort || 'des';

        // 根据 --data 参数更新列配置
        const dataFields = (args.data || 'code,name,dp,dpr,value,hr').split(',');
        const newColumns = dataFields
            .map(f => fieldDefs[f.trim()])
            .filter(Boolean)
            .map(f => f.label);
        dynamicColumns.length = 0;
        dynamicColumns.push(...newColumns);

        // 排序字段映射
        const sortFieldMap = {
            'value': '持仓市值',
            'dayprofit': '当日盈亏',
            'holdprofit': '持有盈亏',
            'holddays': '持仓天数',
        };
        const sortField = sortFieldMap[sortby] || '当日盈亏';

        // 1. 快速鉴权检查 + 账户 ID 保存
        const url = await page.evaluate(() => window.location.href);
        
        // 检测并保存账户 ID
        const accountId = extractAccountId(url);
        if (accountId && accountId !== getSavedAccountId()) {
            saveAccountId(accountId);
        }
        
        if (url.includes('login') || url.includes('auth')) {
            throw new AuthRequiredError('tzzb pos', '未登录。请执行 opencli browser tzzb open https://tzzb.10jqka.com.cn 打开浏览器登录同花顺账号。');
        }

        // 2. 等待表格渲染
        const ready = await page.evaluate(async () => {
            for (let i = 0; i < 20; i++) {
                const el = document.querySelector('#PositionListTableVirtuoso');
                if (el && el.innerText.includes('持有金额')) return true;
                await new Promise(r => setTimeout(r, 200));
            }
            return false;
        });
        if (!ready) {
            throw new EmptyResultError('tzzb pos', '持仓表格未渲染，请检查页面加载状态');
        }

        // 3. 提取数据
        const rows = await page.evaluate(() => {
            const table = document.querySelector('#PositionListTableVirtuoso');
            if (!table) return null;
            const allText = table.innerText;
            const lines = allText.split('\n').filter(l => l.trim());
            if (lines.length < 2) return null;
            const parsed = [];
            let current = [];
            for (const line of lines.slice(1)) {
                if (/^\d{6}$/.test(line.trim())) {
                    if (current.length > 0) parsed.push(current);
                    current = [line.trim()];
                } else if (line === '汇总') {
                    if (current.length > 0) parsed.push(current);
                    current = [line];
                } else {
                    current.push(line.trim());
                }
            }
            if (current.length > 0) parsed.push(current);
            return parsed;
        });

        if (!rows || rows.length < 2) {
            throw new EmptyResultError('tzzb pos', '未获取到持仓数据，请确认账号已同步持仓');
        }

        const dataRows = rows.filter(r => /^\d{6}$/.test(r[0]));
        if (dataRows.length === 0) {
            throw new EmptyResultError('tzzb pos', '表格中无股票持仓记录，账户可能为空仓');
        }

        // 提取汇总行
        const summaryRow = rows.find(r => r[0] === '汇总');

        // 汇总字段映射
        const summaryFieldMap = {
            'code': () => '汇总',
            'name': () => '',
            'value': () => fmtNumRaw(summaryRow[1]),
            'dp': () => mergeProfit(summaryRow[2], summaryRow[3]),
            'dpr': () => summaryRow[3] || '--',
            'hp': () => mergeProfit(summaryRow[4], summaryRow[5]),
            'hpr': () => summaryRow[5] || '--',
            'hr': () => summaryRow[9] || '--',
            'hd': () => '--',
            'cost': () => '--',
            'price': () => '--',
        };

        // 构建汇总行（根据 data 字段动态构建）
        const summary = summaryRow ? (() => {
            const obj = {};
            for (const field of dataFields) {
                const fn = summaryFieldMap[field.trim()];
                if (fn) {
                    const def = fieldDefs[field.trim()];
                    obj[def.label] = fn();
                }
            }
            return obj;
        })() : null;

        // 构建股票行（根据 data 字段动态构建）
        const stockRows = dataRows.map(r => {
            const row = {};
            for (const field of dataFields) {
                const def = fieldDefs[field.trim()];
                if (def) {
                    row[def.label] = def.extract(r);
                }
            }
            return row;
        });

        // 排序：根据排序字段提取数值
        const extractNum = (field, row) => {
            // field 是中文列名，找到对应的字段标识
            const fieldKey = Object.keys(fieldDefs).find(k => fieldDefs[k].label === field);
            if (!fieldKey) return 0;
            const val = row[field];
            if (!val || val === '--') return 0;
            // 对于盈亏金额字段，取括号前的数字
            if (fieldKey === 'dp' || fieldKey === 'hp') {
                const numPart = val.split('(')[0];
                return parseFloat(numPart.replace(/[+%]/g, '')) || 0;
            }
            // 其他字段直接取数值
            return parseFloat(val.replace(/[+%]/g, '')) || 0;
        };

        stockRows.sort((a, b) => {
            const va = extractNum(sortField, a);
            const vb = extractNum(sortField, b);
            return sortDir === 'asc' ? va - vb : vb - va;
        });

        return summary ? [...stockRows, summary] : stockRows;
    },
});

// 独立刷新命令
cli({
    site: 'tzzb',
    name: 'reload',
    description: '刷新持仓页面，重新加载最新数据',
    access: 'read',
    domain: SITE,
    strategy: Strategy.COOKIE,
    browser: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    navigateBefore: buildNavigateUrl(),
    siteSession: 'persistent',
    func: async (page, args) => {
        console.log('正在刷新页面...');
        
        // 检测并保存账户 ID
        const url = await page.evaluate(() => window.location.href);
        const accountId = extractAccountId(url);
        if (accountId && accountId !== getSavedAccountId()) {
            saveAccountId(accountId);
        }
        
        // 使用 JavaScript 在页面上下文中刷新
        await page.evaluate(() => location.reload());
        // 在页面上下文中等待
        await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
        
        // 等待表格加载完成
        const ready = await page.evaluate(async () => {
            for (let i = 0; i < 20; i++) {
                const el = document.querySelector('#PositionListTableVirtuoso');
                if (el && el.innerText.includes('持有金额')) return true;
                await new Promise(r => setTimeout(r, 200));
            }
            return false;
        });
        
        if (ready) {
            return { 
                status: 'success', 
                message: '✅ 页面刷新成功，数据已更新',
                timestamp: new Date().toLocaleString('zh-CN')
            };
        } else {
            throw new EmptyResultError('tzzb reload', '页面刷新后数据未加载，请检查网络或重新登录');
        }
    },
});

// 初始化命令：登录并保存账户 ID
cli({
    site: 'tzzb',
    name: 'init',
    description: '初始化账户：登录同花顺并保存账户 ID，后续查询将自动使用该账户',
    access: 'read',
    domain: SITE,
    strategy: Strategy.COOKIE,
    browser: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    navigateBefore: 'https://tzzb.10jqka.com.cn/pc/index.html#/myAccount',
    siteSession: 'persistent',
    func: async (page, args) => {
        console.log('正在检测账户...');
        
        const url = await page.evaluate(() => window.location.href);
        
        if (url.includes('login') || url.includes('auth')) {
            throw new AuthRequiredError('tzzb init', '请先登录。在打开的浏览器窗口中登录同花顺账号后，再次执行 opencli tzzb init');
        }
        
        const accountId = extractAccountId(url);
        if (accountId) {
            saveAccountId(accountId);
            return {
                status: 'success',
                accountId,
                message: `✅ 账户初始化成功！账户 ID: ${accountId}`,
                configPath: ACCOUNT_CONFIG_PATH,
                timestamp: new Date().toLocaleString('zh-CN')
            };
        } else {
            // 尝试等待页面重定向到账户页面
            console.log('等待页面跳转到账户页面...');
            await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
            
            const newUrl = await page.evaluate(() => window.location.href);
            const newAccountId = extractAccountId(newUrl);
            
            if (newAccountId) {
                saveAccountId(newAccountId);
                return {
                    status: 'success',
                    accountId: newAccountId,
                    message: `✅ 账户初始化成功！账户 ID: ${newAccountId}`,
                    configPath: ACCOUNT_CONFIG_PATH,
                    timestamp: new Date().toLocaleString('zh-CN')
                };
            }
            
            return {
                status: 'pending',
                message: '⚠️ 未检测到账户 ID，请确保已登录并访问持仓页面',
                currentUrl: url,
                help: '请在浏览器中手动访问持仓页面，然后再次执行 opencli tzzb init'
            };
        }
    },
});

// 查看账户状态命令
cli({
    site: 'tzzb',
    name: 'status',
    description: '查看已保存的账户 ID 配置',
    access: 'read',
    domain: SITE,
    func: async () => {
        const accountId = getSavedAccountId();
        
        if (accountId) {
            try {
                const config = JSON.parse(fs.readFileSync(ACCOUNT_CONFIG_PATH, 'utf8'));
                return {
                    status: 'configured',
                    accountId,
                    savedAt: config.savedAt,
                    configPath: ACCOUNT_CONFIG_PATH,
                    message: `✅ 已配置账户: ${accountId}`
                };
            } catch (e) {
                return {
                    status: 'configured',
                    accountId,
                    message: `✅ 已配置账户: ${accountId}`,
                    warning: '配置文件读取失败，但账户 ID 已保存'
                };
            }
        } else {
            return {
                status: 'not_configured',
                message: '⚠️ 未配置账户 ID',
                help: '请执行 opencli tzzb init 初始化账户',
                configPath: ACCOUNT_CONFIG_PATH
            };
        }
    },
});
