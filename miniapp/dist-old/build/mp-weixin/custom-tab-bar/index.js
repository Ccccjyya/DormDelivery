Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/tabbar-home/index', text: '首页' },
      { pagePath: '/pages/tabbar-orders/index', text: '订单' },
      { pagePath: '/pages/tabbar-messages/index', text: '消息' },
      { pagePath: '/pages/tabbar-profile/index', text: '我的' }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
      this.setData({ selected: data.index });
    }
  }
});
