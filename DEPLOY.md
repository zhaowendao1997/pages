# 部署到 GitHub Pages，并绑定 zhaowendao1997.cn

这套站点是纯静态的，不需要服务器、不需要数据库。GitHub Pages 负责托管，阿里云负责域名解析。

> 官方参考：[GitHub Pages · Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

整体链路：

```
浏览器 → zhaowendao1997.cn（阿里云 DNS）
       → GitHub Pages 的服务器（185.199.108.153 等）
       → dist/ 里的静态文件
```

---

## 0. 先确认三件事

1. 域名 `zhaowendao1997.cn` 在阿里云账号下，且已经完成**实名认证**。`.cn` 域名没有实名认证会被暂停解析。
2. 有一个 GitHub 账号。免费账号的 Pages 只对**公开仓库**开放。
3. 本地已经能构建：

   ```bash
   node build.mjs
   ```

   看到 `dist/` 生成即可。

---

## 1. 建仓库并推送

在 GitHub 新建一个仓库，比如 `blog`，不要勾选自动生成 README。

在本目录执行（把 `<你的用户名>` 换成自己的）：

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/<你的用户名>/blog.git
git push -u origin main
```

`dist/` 已经被 `.gitignore` 排除，不需要提交；GitHub Actions 会在云端重新构建。

---

## 2. 开启 GitHub Pages

进入仓库的 **Settings → Pages**：

1. **Build and deployment → Source** 选择 **GitHub Actions**。
2. 打开 **Actions** 标签，应该能看到 `Deploy to GitHub Pages` 正在运行。
3. 第一次运行完成后，会得到一个 `https://<你的用户名>.github.io/blog/` 的地址。

> 如果 Actions 里报 `Get Pages site failed` 或 `Not Found`，通常是因为 Source 还停留在 “Deploy from a branch”。改成 GitHub Actions 再重新运行。

> 如果仓库是私有的，免费账号无法开启 Pages。把仓库改成 public，或者升级 GitHub 套餐。

---

## 3. 绑定自定义域名

仍然在 **Settings → Pages**：

1. 在 **Custom domain** 里填 `zhaowendao1997.cn`，点 **Save**。
2. GitHub 会做一次 DNS 检查。此时还没配 DNS，提示失败是正常的。
3. 配好 DNS 之后再回来，勾选 **Enforce HTTPS**。

仓库里的 `public/CNAME` 也写了 `zhaowendao1997.cn`。不过用 **GitHub Actions** 部署时，GitHub 会忽略这个文件，域名以 Settings 里填的为准。它只在「从分支部署」或手动上传到其他静态托管时才有用。

如果以后换域名，记得同时改 Settings 和 `public/CNAME`。

---

## 4. 在阿里云配置 DNS

进入阿里云控制台 → **云解析 DNS** → 找到 `zhaowendao1997.cn` → **解析设置**。

### 先清掉冲突记录

阿里云新买的域名有时会自带「域名 parking」的 A 记录或 CNAME。把 `@` 和 `www` 上已有的、指向 parking 页面的记录删掉，否则会和下面的记录冲突。

### 添加记录

| 记录类型 | 主机记录 | 记录值 | TTL |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | 600 |
| A | `@` | `185.199.109.153` | 600 |
| A | `@` | `185.199.110.153` | 600 |
| A | `@` | `185.199.111.153` | 600 |
| AAAA | `@` | `2606:50c0:8000::153` | 600 |
| AAAA | `@` | `2606:50c0:8001::153` | 600 |
| AAAA | `@` | `2606:50c0:8002::153` | 600 |
| AAAA | `@` | `2606:50c0:8003::153` | 600 |
| CNAME | `www` | `<你的用户名>.github.io` | 600 |

说明：

- 根域名 `@` 用 A / AAAA 记录，这是 GitHub 官方推荐的做法，比在根域上放 CNAME 更稳。
- `www` 用 CNAME 指向 `github.io` 子域。
- 如果你的 DNS 服务商支持根域 CNAME，也可以只加一条 `@ CNAME <用户名>.github.io`，但阿里云上更建议用上面的 A / AAAA。
- TTL 600 秒，改错了好恢复。

> 如果域名之前改过 DNS 服务器（不是阿里云默认的那两组），要到实际托管 DNS 的地方去加记录。

### 等生效

通常几分钟，慢的话半小时到几小时。可以这样检查：

```bash
nslookup zhaowendao1997.cn
nslookup www.zhaowendao1997.cn
```

看到返回 `185.199.108.153` 之类的地址就对了。

---

## 5. 等 HTTPS 证书

DNS 生效后回到 **Settings → Pages**：

- Custom domain 的检查应该变成绿色。
- **Enforce HTTPS** 可以勾选后，GitHub 会自动申请 Let's Encrypt 证书。
- 证书签发可能要几分钟到 24 小时。期间访问 `https://` 可能报证书错误，先用 `http://` 看是否正常。

都好了之后，`https://zhaowendao1997.cn` 就是你的博客了。

---

## 6. 关于 `.cn` 域名和备案

这是最容易混淆的地方，简单说：

- **GitHub Pages 的服务器在境外**。把 `.cn` 域名解析到境外服务器，通常**不需要 ICP 备案**，但域名本身必须完成**实名认证**。
- 如果你以后把站点迁到**阿里云 OSS、CDN、ECS 等中国大陆境内的服务**，并且绑定这个域名，就**必须先做 ICP 备案**，否则阿里云不会允许绑定。
- 备案通过后，通常还要求在 30 天内做**公安联网备案**。

所以现在这套「GitHub Pages + 阿里云 DNS」的方案，可以先跑起来；等以后访问量大了、想要国内速度，再考虑备案 + 国内对象存储/CDN。

> 政策会变，实际以阿里云备案系统和工信部要求为准。

---

## 7. 日常更新

改完文章或图片后：

```bash
node build.mjs          # 本地先看一眼
git add .
git commit -m "new post"
git push
```

推送后 GitHub Actions 会自动构建并发布，通常一两分钟。

本地预览：

```bash
node serve.mjs
# 或
node serve.mjs --watch
```

---

## 8. 备选方案

### Cloudflare Pages

- 免费，自定义域名，自带 CDN。
- 在 Cloudflare 里连 GitHub 仓库，构建命令 `node build.mjs`，输出目录 `dist`。
- 然后把域名的 DNS 服务器改成 Cloudflare 的，或者只把 `@` / `www` 的 CNAME 指过去。
- 如果继续用阿里云 DNS，注意不要在 Cloudflare 里开橙色云朵代理再去指 GitHub Pages，容易和 GitHub 的证书、重定向打架。用 Cloudflare Pages 则可以直接用它的 CNAME。

### 阿里云 OSS

适合图片多、想要国内速度的情况，但**绑定自定义域名需要 ICP 备案**。

1. 新建 Bucket，读写权限设为「公共读」。
2. 开启「静态页面」，默认首页 `index.html`，默认 404 页 `404.html`。
3. 把 `dist/` 里的内容全部上传到 Bucket 根目录。
4. 绑定自定义域名，开启 HTTPS（可以用阿里云免费证书）。
5. 在云解析里把域名 CNAME 到 Bucket 的访问域名。

### 阿里云 ECS + Nginx

最自由，也最需要维护。装 Nginx，把 `dist/` 传上去，配一个 `server` 块即可。同样需要备案。

---

## 9. 常见问题

**打开是 404，或者页面没有样式？**

- 确认 Pages 的 Source 是 **GitHub Actions**，并且 Actions 最后一次运行成功。
- 确认访问的是 `https://zhaowendao1997.cn/`，而不是 `https://zhaowendao1997.cn/blog/`。
- 如果部署在 `用户名.github.io/blog/` 这种子路径下，需要把 `site.config.mjs` 里的 `base` 改成 `'/blog'` 再构建。当前配置是按自定义域名（根路径）写的。

**DNS 检查一直失败？**

- 用 `nslookup -type=A zhaowendao1997.cn` 看是否已经返回 GitHub 的 IP。
- 检查是否还有旧的 A / CNAME 记录冲突。
- 阿里云的「域名 parking」记录一定要删掉。
- 刚改完 DNS 需要等 TTL 过期。

**HTTPS 一直“Not yet available”？**

- 先确认 DNS 已经生效。
- 不要同时开 CDN 代理（比如 Cloudflare 橙色云朵）再指 GitHub Pages，容易卡证书。
- 如果域名配了 CAA 记录，需要允许 `letsencrypt.org` 签发。
- 实在不行，先把 Custom domain 删掉，等几分钟再重新添加，让 GitHub 重新签一次。

**国内访问很慢或偶尔打不开？**

GitHub Pages 的节点在境外，国内访问质量不稳定，这是正常现象。可以：

- 先用着，读者主要用 RSS 或直接访问；
- 换 Cloudflare Pages / Vercel；
- 或者备案后迁到阿里云 OSS + CDN。

**照片太多，仓库/站点会不会超限？**

GitHub Pages 建议单站不超过 1GB，每月 100GB 流量软限制。照片上传前压缩到长边 1600px、JPEG 质量 80，通常一张 200–400KB。以后照片多了，可以把原图放对象存储，页面只放压缩版。

**评论怎么办？**

站点本身没有评论。可以接：

- **Giscus**：基于 GitHub Discussions，免费，不需要服务器；
- **Twikoo**：可以部署在 Vercel / 云函数上。

两者的脚本都可以直接贴进 `lib/render.mjs` 的布局里。

---

## 10. 上线检查清单

- [ ] `site.config.mjs` 里的站点名、邮箱、社交链接都改成了自己的
- [ ] `public/CNAME` 和 GitHub Settings 里的域名一致
- [ ] 示例文章和示例照片已经替换（或删除）
- [ ] 图片压缩过，封面和相册照片单张不超过 500KB
- [ ] `node build.mjs` 本地构建通过
- [ ] GitHub Actions 最后一次运行是绿色
- [ ] 阿里云 DNS 的 A / AAAA / CNAME 记录正确
- [ ] HTTPS 已开启，`http://` 会跳转到 `https://`
- [ ] `/feed.xml`、`/sitemap.xml`、`/search.json` 都能打开
- [ ] 手机上看一遍首页、文章、相册
