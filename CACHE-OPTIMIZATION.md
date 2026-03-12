# 缓存优化说明

## 问题
之前每次打开页面都要重新加载所有数据，即使有缓存也不使用。

## 原因
SWR 默认配置 `revalidateIfStale: true`，导致即使有缓存，只要数据被认为是"过期的"，就会立即重新请求。

## 解决方案

### 1. 全局配置优化 (SWRProvider.tsx)
```typescript
{
  revalidateIfStale: false,        // 不自动重验证过期数据
  revalidateOnFocus: false,        // 不在焦点时重验证
  revalidateOnReconnect: true,     // 网络恢复时重验证
  dedupingInterval: 30_000,        // 30秒内去重
  keepPreviousData: true,          // 保留旧数据
}
```

### 2. 分层缓存策略
根据数据类型设置不同的缓存时间：

| 策略 | 缓存时间 | 适用场景 |
|------|---------|---------|
| `realtime` | 30秒 | 今天的数据（coverage, sentiment） |
| `historical` | 5分钟 | 历史数据（昨天的 sentiment） |
| `statistics` | 10分钟 | 统计数据（7天建议、action items） |
| `static` | 30分钟 | 静态数据（问题模板、配置） |

### 3. 使用方法
```typescript
import { getCacheConfig } from '@/contexts/SWRProvider';

// 实时数据
useSWR('/api/dashboard/coverage', { ...getCacheConfig('realtime') });

// 历史数据
useSWR('/api/dashboard/sentiment-yesterday', { ...getCacheConfig('historical') });

// 统计数据
useSWR('/api/dashboard/suggestions', { ...getCacheConfig('statistics') });

// 静态数据
useSWR('/api/question-templates', { ...getCacheConfig('static') });
```

## 效果
- 打开页面时，如果有缓存，**立即显示缓存数据**，不等待 API 响应
- 后台会根据缓存策略决定是否更新数据
- 大幅提升页面加载速度和用户体验

## 已优化的页面
- ✅ Dashboard 页面 (apps/web/app/(main)/dashboard/page.tsx)
- ✅ DailyReviewCard 组件 (apps/web/components/dashboard/DailyReviewCard.tsx)
- ✅ Recorder 页面 (apps/web/app/(main)/recorder/page.tsx)

## 测试工具
创建了 `test-api-speed.sh` 脚本来测试 API 响应时间：
```bash
TEST_TOKEN='your-jwt-token' bash test-api-speed.sh
```
