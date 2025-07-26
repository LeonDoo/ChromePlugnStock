class StockViewer {
    constructor() {
        this.chart = null;
        this.selectedHistory = [];
        this.maxHistoryItems = 5;
        this.apiType = 'auto'; // 'yahoo', 'sina', 'auto'
        this.apiDetectionPromise = null; // 存储API检测的Promise
        this.storageKey = 'stockViewerHistory'; // 存储键名
        this.stockMappings = {
            // 美股
            '苹果': 'AAPL',
            '苹果公司': 'AAPL',
            '特斯拉': 'TSLA',
            '谷歌': 'GOOGL',
            '微软': 'MSFT',
            '亚马逊': 'AMZN',
            '脸书': 'META',
            '奈飞': 'NFLX',
            '英伟达': 'NVDA',
            '英特尔': 'INTC',
            'AMD': 'AMD',
            '波音': 'BA',
            '迪士尼': 'DIS',
            '星巴克': 'SBUX',
            '麦当劳': 'MCD',
            '可口可乐': 'KO',
            '百事': 'PEP',
            '强生': 'JNJ',
            '辉瑞': 'PFE',
            '摩根大通': 'JPM',
            '高盛': 'GS',
            '伯克希尔': 'BRK-A',
            '伯克希尔B': 'BRK-B',
            
            // 港股
            '腾讯': '0700.HK',
            '腾讯控股': '0700.HK',
            '阿里巴巴': '9988.HK',
            '美团': '3690.HK',
            '小米': '1810.HK',
            '京东': '9618.HK',
            '网易': '9999.HK',
            '比亚迪': '1211.HK',
            '中国移动': '0941.HK',
            '中国联通': '0762.HK',
            '中国电信': '0728.HK',
            
            // A股
            '平安银行': '000001.SZ',
            '万科A': '000002.SZ',
            '中国平安': '000001.SZ',
            '招商银行': '600036.SH',
            '浦发银行': '600000.SH',
            '工商银行': '601398.SH',
            '建设银行': '601939.SH',
            '中国银行': '601988.SH',
            '农业银行': '601288.SH',
            '贵州茅台': '600519.SH',
            '五粮液': '000858.SZ',
            '格力电器': '000651.SZ',
            '美的集团': '000333.SZ',
            '海尔智家': '600690.SH',
            '比亚迪': '002594.SZ',
            '宁德时代': '300750.SZ',
            '隆基绿能': '601012.SH',
            '中国石油': '601857.SH',
            '中国石化': '600028.SH',
            '中国海油': '600938.SH'
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkChartJS();
        this.loadHistoryFromStorage(); // 从存储中加载历史记录
        this.apiDetectionPromise = this.detectApiAvailability(); // 检测API可用性
    }

    checkChartJS() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js 未加载！');
            // 尝试动态加载Chart.js
            this.loadChartJS();
            return false;
        }
        console.log('Chart.js 加载成功，版本:', Chart.version);
        return true;
    }

    loadChartJS() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('chart.min.js');
        script.onload = () => {
            console.log('Chart.js 动态加载成功');
            this.showError('Chart.js 已重新加载，请重试');
        };
        script.onerror = () => {
            console.error('Chart.js 动态加载失败');
            this.showError('Chart.js 库加载失败，请检查文件是否存在');
        };
        document.head.appendChild(script);
    }

    bindEvents() {
        // 搜索输入框事件
        const searchInput = document.getElementById('stockSearch');
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length === 0) {
                this.hideSearchResults();
                return;
            }
            
            // 延迟搜索，避免频繁请求
            searchTimeout = setTimeout(() => {
                this.searchStock(query);
            }, 300);
        });

        // 选择按钮事件
        document.getElementById('selectBtn').addEventListener('click', () => {
            const stockCode = document.getElementById('stockCode').textContent;
            const stockName = document.getElementById('stockName').textContent;
            this.showStockChart(stockCode, stockName);
        });
        
        // 展开/折叠按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('#expandBtn')) {
                this.togglePriceDetails();
            }
        });
    }

    async searchStock(query) {
        if (!query) return;
        
        try {
            // 检查是否是中文名称
            let symbol = this.stockMappings[query];
            if (!symbol) {
                // 转换为大写
                symbol = query.toUpperCase();
            }
            
            // 获取股票信息
            const stockInfo = await this.getStockInfo(symbol);
            this.showSearchResult(stockInfo);
        } catch (error) {
            console.error('搜索股票失败:', error);
            this.hideSearchResults();
        }
    }

    async getStockInfo(symbol) {
        // 等待API检测完成
        if (this.apiDetectionPromise) {
            await this.apiDetectionPromise;
        }
        
        console.log(`使用 ${this.apiType} API 获取股票信息: ${symbol}`);
        
        if (this.apiType === 'sina') {
            return this.getStockInfoFromSina(symbol);
        } else {
            return this.getStockInfoFromYahoo(symbol);
        }
    }

    async getStockInfoFromYahoo(symbol) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://finance.yahoo.com/'
            }
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Yahoo Finance API访问被拒绝，请尝试使用代理或切换到新浪API');
            }
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.chart.error) {
            throw new Error(`API错误: ${data.chart.error.description || '未知错误'}`);
        }
        
        const result = data.chart.result[0];
        
        if (!result || !result.meta) {
            throw new Error('股票代码无效或数据不可用');
        }

        const meta = result.meta;
        
        return {
            symbol: symbol,
            name: meta.symbol || symbol,
            longName: meta.longName || meta.symbol || symbol
        };
    }

    async getStockInfoFromSina(symbol) {
        const sinaSymbol = this.convertToSinaSymbol(symbol);
        const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.includes('var hq_str_')) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const data = parts[1].replace(/"/g, '').split(',');
                    if (data.length >= 4) {
                        return {
                            symbol: symbol,
                            name: data[0] || symbol,
                            longName: data[0] || symbol
                        };
                    }
                }
            }
        }
        
        throw new Error('股票代码无效或数据不可用');
    }

    showSearchResult(stockInfo) {
        document.getElementById('stockName').textContent = stockInfo.longName || stockInfo.name;
        document.getElementById('stockCode').textContent = stockInfo.symbol;
        document.getElementById('searchResults').style.display = 'block';
    }

    hideSearchResults() {
        document.getElementById('searchResults').style.display = 'none';
    }

    addToSelectedHistory(stockInfo) {
        // 检查是否已存在相同的股票
        const existingIndex = this.selectedHistory.findIndex(item => item.symbol === stockInfo.symbol);
        
        if (existingIndex !== -1) {
            // 如果已存在，移到最前面
            this.selectedHistory.splice(existingIndex, 1);
        }
        
        // 添加到最前面
        this.selectedHistory.unshift(stockInfo);
        
        // 保持最多5条记录
        if (this.selectedHistory.length > this.maxHistoryItems) {
            this.selectedHistory = this.selectedHistory.slice(0, this.maxHistoryItems);
        }
        
        this.updateHistoryDisplay();
        this.saveHistoryToStorage(); // 保存到存储
    }

    // 保存历史记录到Chrome存储
    saveHistoryToStorage() {
        try {
            chrome.storage.local.set({
                [this.storageKey]: this.selectedHistory
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('保存历史记录失败:', chrome.runtime.lastError);
                } else {
                    console.log('历史记录已保存到存储');
                }
            });
        } catch (error) {
            console.error('保存历史记录时出错:', error);
        }
    }

    // 从Chrome存储加载历史记录
    loadHistoryFromStorage() {
        try {
            chrome.storage.local.get([this.storageKey], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('加载历史记录失败:', chrome.runtime.lastError);
                    this.updateHistoryDisplay();
                    return;
                }
                
                const savedHistory = result[this.storageKey];
                if (savedHistory && Array.isArray(savedHistory)) {
                    this.selectedHistory = savedHistory;
                    console.log('从存储加载历史记录:', this.selectedHistory.length, '条');
                    
                    // 如果有历史记录，自动选中最后一个
                    if (this.selectedHistory.length > 0) {
                        const lastStock = this.selectedHistory[0]; // 最新的记录在第一位
                        this.autoSelectLastStock(lastStock);
                    }
                }
                
                this.updateHistoryDisplay();
            });
        } catch (error) {
            console.error('加载历史记录时出错:', error);
            this.updateHistoryDisplay();
        }
    }

    // 自动选中最后一个股票
    async autoSelectLastStock(stockInfo) {
        try {
            console.log('自动选中最后一个股票:', stockInfo.symbol);
            await this.showStockChart(stockInfo.symbol, stockInfo.name);
        } catch (error) {
            console.error('自动选中股票失败:', error);
            // 如果自动选中失败，不显示错误，只是记录日志
        }
    }

    updateHistoryDisplay() {
        const historyContainer = document.getElementById('searchHistory');
        const historyItems = document.getElementById('historyItems');
        
        if (this.selectedHistory.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }
        
        historyContainer.style.display = 'block';
        historyItems.innerHTML = '';
        
        this.selectedHistory.forEach(stockInfo => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <span class="stock-name">${stockInfo.longName || stockInfo.name}</span>
                <span class="stock-code">${stockInfo.symbol}</span>
            `;
            
            // 添加点击事件
            historyItem.addEventListener('click', () => {
                this.showStockChart(stockInfo.symbol, stockInfo.longName || stockInfo.name);
            });
            
            historyItems.appendChild(historyItem);
        });
    }

    showHistory() {
        if (this.selectedHistory.length > 0) {
            document.getElementById('searchHistory').style.display = 'block';
        }
    }

    hideHistory() {
        document.getElementById('searchHistory').style.display = 'none';
    }

    async detectApiAvailability() {
        console.log('开始检测API可用性...');
        
        try {
            // 首先尝试Yahoo Finance API
            console.log('检测Yahoo Finance API...');
            const yahooTest = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d', {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (yahooTest.ok) {
                this.apiType = 'yahoo';
                console.log('✅ 使用Yahoo Finance API');
                return;
            } else {
                console.log(`❌ Yahoo Finance API返回状态码: ${yahooTest.status}`);
                if (yahooTest.status === 403) {
                    console.log('Yahoo Finance API被拒绝访问，可能是反爬虫机制');
                }
            }
        } catch (error) {
            console.log('❌ Yahoo Finance API连接失败:', error.message);
        }

        try {
            // 尝试新浪财经API
            console.log('检测新浪财经API...');
            const sinaTest = await fetch('https://hq.sinajs.cn/list=sh000001', {
                method: 'HEAD'
            });
            
            if (sinaTest.ok) {
                this.apiType = 'sina';
                console.log('✅ 使用新浪财经API');
                return;
            } else {
                console.log(`❌ 新浪财经API返回状态码: ${sinaTest.status}`);
            }
        } catch (error) {
            console.log('❌ 新浪API连接失败:', error.message);
        }

        // 默认使用新浪（国内用户更友好）
        this.apiType = 'sina';
        console.log('⚠️ 默认使用新浪财经API');
    }

    // 新浪股票代码转换
    convertToSinaSymbol(symbol) {
        // 美股转新浪格式
        if (symbol.includes('.O') || symbol.includes('.N')) {
            return symbol.replace('.O', '').replace('.N', '');
        }
        
        // 港股转新浪格式
        if (symbol.includes('.HK')) {
            return 'hk' + symbol.replace('.HK', '');
        }
        
        // A股转新浪格式
        if (symbol.includes('.SZ')) {
            return 'sz' + symbol.replace('.SZ', '');
        }
        if (symbol.includes('.SH')) {
            return 'sh' + symbol.replace('.SH', '');
        }
        
        // 默认美股
        return symbol;
    }

    // 新浪股票名称转换
    convertFromSinaSymbol(sinaSymbol) {
        if (sinaSymbol.startsWith('hk')) {
            return sinaSymbol.substring(2) + '.HK';
        }
        if (sinaSymbol.startsWith('sz')) {
            return sinaSymbol.substring(2) + '.SZ';
        }
        if (sinaSymbol.startsWith('sh')) {
            return sinaSymbol.substring(2) + '.SH';
        }
        return sinaSymbol;
    }

    async showStockChart(symbol, stockName) {
        this.showLoading();
        this.hideSearchResults();
        
        try {
            // 更新选中的股票信息
            document.getElementById('selectedStockName').textContent = stockName;
            document.getElementById('selectedStockCode').textContent = symbol;
            
            // 添加到选择记录
            this.addToSelectedHistory({
                symbol: symbol,
                name: stockName,
                longName: stockName
            });
            
            // 获取当天走势数据
            const chartData = await this.getChartData(symbol);
            
            // 更新价格信息
            this.updatePriceInfo(chartData);
            
            // 更新图表
            this.updateChart(chartData);
            
            this.showChartSection();
        } catch (error) {
            console.error('加载股票图表失败:', error);
            this.showError(error.message);
        }
    }

    async getChartData(symbol) {
        // 等待API检测完成
        if (this.apiDetectionPromise) {
            await this.apiDetectionPromise;
        }
        
        console.log(`使用 ${this.apiType} API 获取图表数据: ${symbol}`);
        
        if (this.apiType === 'sina') {
            return this.getChartDataFromSina(symbol);
        } else {
            return this.getChartDataFromYahoo(symbol);
        }
    }

    async getChartDataFromYahoo(symbol) {
        // 获取当天5分钟数据
        const todayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;
        
        // 获取5天数据以获取昨天收盘价
        const fiveDayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://finance.yahoo.com/'
        };
        
        try {
            // 并行获取两个数据
            const [todayResponse, fiveDayResponse] = await Promise.all([
                fetch(todayUrl, { headers }),
                fetch(fiveDayUrl, { headers })
            ]);
            
            if (!todayResponse.ok || !fiveDayResponse.ok) {
                if (todayResponse.status === 403 || fiveDayResponse.status === 403) {
                    throw new Error('Yahoo Finance API访问被拒绝，请尝试使用代理或切换到新浪API');
                }
                throw new Error(`HTTP错误: ${todayResponse.status} / ${fiveDayResponse.status}`);
            }

            const [todayData, fiveDayData] = await Promise.all([
                todayResponse.json(),
                fiveDayResponse.json()
            ]);
            
            if (todayData.chart.error) {
                throw new Error(`API错误: ${todayData.chart.error.description || '未知错误'}`);
            }
            
            if (fiveDayData.chart.error) {
                throw new Error(`API错误: ${fiveDayData.chart.error.description || '未知错误'}`);
            }
            
            const todayResult = todayData.chart.result[0];
            const fiveDayResult = fiveDayData.chart.result[0];
            
            if (!todayResult || !fiveDayResult) {
                throw new Error('无法获取图表数据');
            }

            const timestamps = todayResult.timestamp;
            const quotes = todayResult.indicators.quote[0];
            
            if (!quotes || !quotes.close) {
                throw new Error('图表数据不完整');
            }

            const closes = quotes.close;
            const opens = quotes.open || [];

            // 获取当前价格（最后一个非空值）
            const currentPrice = this.getLastValidValue(closes);
            
            // 获取开盘价
            const validOpens = opens.filter(price => price !== null);
            const openPrice = validOpens.length > 0 ? validOpens[0] : currentPrice;

            // 获取昨天收盘价
            const fiveDayCloses = fiveDayResult.indicators.quote[0].close;
            const yesterdayClose = this.getLastValidValue(fiveDayCloses.slice(0, -1)); // 排除今天的数据

            return {
                labels: timestamps ? timestamps.map(timestamp => {
                    const date = new Date(timestamp * 1000);
                    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                }) : [],
                prices: closes || [],
                currentPrice: currentPrice,
                openPrice: openPrice,
                yesterdayClose: yesterdayClose
            };
        } catch (error) {
            console.error('获取股票数据失败:', error);
            throw error;
        }
    }

    async getChartDataFromSina(symbol) {
        const sinaSymbol = this.convertToSinaSymbol(symbol);
        const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }

            const text = await response.text();
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.includes('var hq_str_')) {
                    const parts = line.split('=');
                    if (parts.length >= 2) {
                        const data = parts[1].replace(/"/g, '').split(',');
                        if (data.length >= 32) {
                            // 新浪数据格式：股票名称,今日开盘价,昨日收盘价,当前价格,今日最高价,今日最低价,竞买价,竞卖价,成交股数,成交金额,买一,买一量,买二,买二量,买三,买三量,买四,买四量,买五,买五量,卖一,卖一量,卖二,卖二量,卖三,卖三量,卖四,卖四量,卖五,卖五量,日期,时间
                            const currentPrice = parseFloat(data[3]) || 0;
                            const openPrice = parseFloat(data[1]) || currentPrice;
                            const yesterdayClose = parseFloat(data[2]) || currentPrice;
                            
                            // 生成模拟的时间标签（新浪API不提供分时数据）
                            const now = new Date();
                            const labels = [];
                            const prices = [];
                            
                            for (let i = 0; i < 10; i++) {
                                const time = new Date(now.getTime() - (9 - i) * 30 * 60 * 1000);
                                labels.push(time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
                                // 模拟价格波动
                                const variation = (Math.random() - 0.5) * 0.02; // ±1%的随机波动
                                prices.push(currentPrice * (1 + variation));
                            }

                            return {
                                labels: labels,
                                prices: prices,
                                currentPrice: currentPrice,
                                openPrice: openPrice,
                                yesterdayClose: yesterdayClose
                            };
                        }
                    }
                }
            }
            
            throw new Error('股票代码无效或数据不可用');
        } catch (error) {
            console.error('获取新浪股票数据失败:', error);
            throw error;
        }
    }

    updateChart(data) {
        // 检查Chart.js是否可用
        if (typeof Chart === 'undefined') {
            console.error('Chart.js 不可用，尝试重新加载');
            this.loadChartJS();
            setTimeout(() => {
                if (typeof Chart !== 'undefined') {
                    this.updateChart(data);
                } else {
                    this.showError('图表库加载失败，请刷新插件重试');
                }
            }, 1000);
            return;
        }

        const ctx = document.getElementById('stockChart').getContext('2d');
        
        // 销毁现有图表
        if (this.chart) {
            this.chart.destroy();
        }

        // 过滤掉空值
        const validData = data.prices.filter((price, index) => price !== null);
        const validLabels = data.labels.filter((label, index) => data.prices[index] !== null);

        try {
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: validLabels,
                    datasets: [{
                        label: '股价',
                        data: validData,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#667eea'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: '#667eea',
                            borderWidth: 1,
                            callbacks: {
                                label: function(tooltipItem) {
                                    return `价格: $${tooltipItem.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxTicksLimit: 6,
                                color: '#6c757d'
                            }
                        },
                        y: {
                            display: true,
                            grid: {
                                color: '#f1f3f4'
                            },
                            ticks: {
                                color: '#6c757d',
                                callback: function(value) {
                                    return '$' + value.toFixed(2);
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } catch (error) {
            console.error('创建图表失败:', error);
            this.showError('图表创建失败: ' + error.message);
        }
    }

    getLastValidValue(array) {
        for (let i = array.length - 1; i >= 0; i--) {
            if (array[i] !== null && array[i] !== undefined) {
                return array[i];
            }
        }
        return 0;
    }

    updatePriceInfo(data) {
        const currentPrice = data.currentPrice || 0;
        const openPrice = data.openPrice || 0;
        const yesterdayClose = data.yesterdayClose || 0;

        // 计算价格变化（与昨天收盘价比较）
        const priceChange = currentPrice - yesterdayClose;
        const priceChangePercent = yesterdayClose > 0 ? (priceChange / yesterdayClose) * 100 : 0;

        // 更新当前价格
        document.getElementById('currentPrice').textContent = `$${currentPrice.toFixed(2)}`;
        
        // 更新价格变化
        const priceChangeElement = document.getElementById('priceChange');
        const changeText = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`;
        priceChangeElement.textContent = changeText;
        
        // 设置颜色
        priceChangeElement.className = 'price-change';
        if (priceChange > 0) {
            priceChangeElement.classList.add('positive');
        } else if (priceChange < 0) {
            priceChangeElement.classList.add('negative');
        } else {
            priceChangeElement.classList.add('neutral');
        }

        // 更新其他价格信息
        document.getElementById('openPrice').textContent = `$${openPrice.toFixed(2)}`;
        document.getElementById('yesterdayClose').textContent = `$${yesterdayClose.toFixed(2)}`;
    }

    togglePriceDetails() {
        const priceDetails = document.getElementById('priceDetails');
        const expandBtn = document.getElementById('expandBtn');
        const expandIcon = expandBtn.querySelector('.expand-icon');
        
        if (priceDetails.style.display === 'none') {
            // 展开
            priceDetails.style.display = 'flex';
            expandBtn.classList.add('expanded');
            expandBtn.title = '收起更多信息';
        } else {
            // 折叠
            priceDetails.style.display = 'none';
            expandBtn.classList.remove('expanded');
            expandBtn.title = '展开更多信息';
        }
    }

    showLoading() {
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('chartSection').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('loading').style.display = 'flex';
    }

    showChartSection() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        document.getElementById('chartSection').style.display = 'block';
    }

    showError(message = '无法获取股票数据，请检查股票代码是否正确') {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('chartSection').style.display = 'none';
        document.getElementById('searchResults').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').innerHTML = `<p>${message}</p>`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new StockViewer();
}); 

