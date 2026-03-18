# composables / hooks 迁移说明

## 文档定位

这份文档记录了一个中间阶段：项目曾把 `composables/` 与 `hooks/` 合并为单一目录。当前代码已经进一步迁移到 FSD 分层，`src/hooks/` 也已退出主链路。

## 当前对应关系

| 历史能力 | 当前落点 |
| -------- | -------- |
| `useEditor` | `src/features/note-editor` + `src/widgets/editor` |
| `useTheme` | `src/features/theme-switch` |
| `useAuth` | `src/processes/session` |
| `useSync` | `src/processes/sync-notes` |
| `useRealtime` | `src/processes/session` |
| `useUserPublicNotesSync` | `src/processes/public-notes` |
| `useNavigationHistory` | `src/processes/navigation` |
| `useSmartBackButton` | `src/processes/navigation` |
| `useNoteFiles` | `src/entities/note/model/use-note-files.ts` |
| `useWebAuthn` | `src/shared/lib/security/use-web-authn.ts` |
| `useVisualViewport` | `src/shared/lib/viewport/use-visual-viewport.ts` |
| `useIonicLongPressList` | `src/shared/lib/ionic/use-ionic-long-press-list.ts` |
| `useDeviceType` | `src/shared/lib/device/use-device-type.ts` |

## 当前结论

“合并到 hooks” 已经不是最终状态。后续设计与重构应直接判断能力归属：

- 跨页面长流程：放 `processes`
- 用户动作与用例：放 `features`
- 领域状态：放 `entities`
- 通用能力：放 `shared/lib`
- 业务组合 UI：放 `widgets`

## 开发建议

如果遇到历史文档或旧提交里提到 `@/hooks/...`：

1. 先判断它属于流程、用例、领域还是通用能力。
2. 再到当前 FSD 目录中寻找对应实现。
3. 不再新增 `src/hooks/` 文件。
