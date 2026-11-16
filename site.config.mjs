/**
 * 站点配置：改这里就能改掉站点名、简介、导航、社交链接。
 * base 留空即可；如果部署在 username.github.io/repo 这种子路径下，把它改成 '/repo'。
 */
export const site = {
  url: 'https://zhaowendao1997.cn',
  base: '',
  lang: 'zh-CN',
  title: '朝闻道',
  fullTitle: '朝闻道的小站',
  description: '朝闻道的个人博客：写一点小作文，放一些喜欢的照片，聊聊相机和镜头。',
  author: '朝闻道',
  signature: '白河夜船。',
  aboutLine: '朝闻道无趣的一生',
  email: 'hello@zhaowendao1997.cn',
  since: 2026,

  // 头像：首页左上角那个圆。放一张图在这里就会按中心正方形裁切显示。
  // 换图不用手动裁——双击根目录的「换头像.bat」选一张图，它会自动裁成 800×800。
  avatar: '/images/site/avatar.jpg',

  hero: {
    image: '/images/site/hero.jpg',
    eyebrow: 'ZhaoWendao · EST. 2021',
  },

  // 首页背景轮播：只放你精选的照片，没列出的不会出现在首页。
  // 现在是纯白首页，所以留空；想恢复照片背景，把图片路径填回来就行（样式和脚本都还在）。
  portalPhotos: [],

  sections: {
    essays: {
      mark: '话',
      label: '狗屁话',
      bio: '写点小作文。',
      intro: '喝醉了就乱写，没喝醉更胡乱写。',
      nav: [
        { label: '狗屁话', href: '/essays/', key: 'essays' },
        { label: '归档', href: '/archive/', key: 'archive' },
        { label: '关于我与网站', href: '/about/', key: 'about' },
      ],
    },
    photos: {
      mark: '片',
      label: '小烂片',
      bio: '按册存放的光影。',
      intro: '随手乱拍。拍到什么算什么。',
      nav: [
        { label: '小烂片', href: '/photos/', key: 'photos' },
        { label: '关于我与网站', href: '/about/', key: 'about' },
      ],
    },
    gear: {
      mark: '古',
      label: '老古董',
      bio: '相机与镜头的使用笔记。',
      intro: '因为没钱所以只能在收藏家和器材党之间选择了当垃圾佬。目前玩得很开心。',
      nav: [
        { label: '老古董', href: '/gear/', key: 'gear' },
        { label: '关于我与网站', href: '/about/', key: 'about' },
      ],
    },
    about: {
      mark: '朝',
      label: '关于我与网站',
      bio: '乱写 乱拍 乱玩',
      nav: [{ label: '关于我与网站', href: '/about/', key: 'about' }],
    },
  },

  socials: [
    // { label: 'Bilibili', href: 'https://space.bilibili.com/498554636' },
  ],

  // “关于”页和器材页会用到
  kit: [
    { role: '机身', name: 'Canon EOS 5D Mark IV' },
    { role: '镜头', name: 'Canon EF 24-105mm f/4L IS USM' },
  ],

  footerNote: '除非特别注明，本站文字与照片均为原创。',
};
