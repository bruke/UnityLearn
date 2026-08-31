# UnityLearn

Unity 进阶学习笔记站点（VitePress + GitHub Pages）。

## 本地预览

```bash
npm install
npm run docs:dev
```

浏览器打开提示的本地地址即可。构建预览：

```bash
npm run docs:build
npm run docs:preview
```

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库（建议名与本目录一致，例如 `UnityLearn`）。
2. 把本目录推上去：

```bash
git init
git add .
git commit -m "Add UnityLearn docs site"
git branch -M main
git remote add origin https://github.com/<你的用户名>/UnityLearn.git
git push -u origin main
```

3. 打开仓库 **Settings → Pages**，Source 选 **GitHub Actions**。
4. 等待 Actions 里 `Deploy GitHub Pages` 成功。站点地址一般为：

`https://<你的用户名>.github.io/UnityLearn/`

若仓库名是 `<用户名>.github.io`，站点会发布在根路径 `/`。
