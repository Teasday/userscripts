/* global natsort */

(function () {
  function jqFetch(opts) {
    return new Promise((resolve, reject) => {
      jQuery.ajax(opts).done(resolve).fail(reject)
    })
  }

  class Manga {
    constructor(data) {
      this._data = data.manga
      this.chapters = Object.entries(data.chapter).map(([id,data]) => { data.id = parseInt(id); return data })
      this.chapterList = []
    }

    get id() { return this._data.id }
    get title() { return this._data.title }
    get url() { return this._data.url }
    get langCode() { return this._data.lang_code }
    get langName() { return this._data.lang_name }
    get isLongStrip() { return !!this._data.long_strip }

    getChapterData(id) {
      return this.chapters.find(c => c.id === id)
    }

    getChapterTitle(id, numOnly) {
      const ch = this.getChapterData(id)
      if (!ch) {
        return null
      } else {
        let title = ''
        if (ch.volume) title += `Vol. ${ch.volume} `
        if (ch.chapter) title += `Ch. ${ch.chapter} `
        if (ch.title && !numOnly) title += `${ch.title}`
        if (!title) title = 'Oneshot'
        return title.trim()
      }
    }

    getChapterName(id) {
      const ch = this.getChapterData(id)
      if (!ch) {
        return null
      } else {
        if (ch.title)
          return ch.title
        if (ch.chapter)
          return `Ch. ${ch.chapter}`
        if (ch.volume)
          return `Vol. ${ch.volume}`
        return 'Oneshot'
      }
    }

    makeChapterList(lang, [g1, g2, g3]) {
      this.chapterList = []
      const sameLang = this.chapters.filter(c => c.lang_code === lang)
      Manga.sortChapters(sameLang)
      let best = null
      for (let ch of sameLang) {
        if (!best) {
          best = ch
        } else {
          if (!ch.chapter && (!ch.volume || ch.volume === "0") || (best.chapter !== ch.chapter || best.volume !== ch.volume)) {
            this.chapterList.push(best)
            best = ch
          } else if (ch.group_id === g1 && ch.group_id_2 === g2 && ch.group_id_3 === g3) {
            best = ch
          }
        }
      }
      this.chapterList.push(best)
      return this.chapterList
    }

    getGroupsOfChapter(id) {
      const cur = this.getChapterData(id)
      if (!cur) {
        return null
      } else {
        const isNonNumbered = (cur.volume === "" || cur.volume === "0") && cur.chapter === ""
        return this.chapters.filter(c =>
          c.lang_code === cur.lang_code
          && c.volume === cur.volume && c.chapter === cur.chapter
          && (!isNonNumbered || cur.title === c.title)
        )
      }
    }

    getPrevChapterId(id) {
      const index = this.chapterList.findIndex(c => c.id === id)
      if (index <= 0) {
        return 0
      } else {
        return this.chapterList[index - 1].id
      }
    }

    getNextChapterId(id) {
      const index = this.chapterList.findIndex(c => c.id === id)
      if (index === -1 || index === this.chapterList.length - 1) {
        return 0
      } else {
        return this.chapterList[index + 1].id
      }
    }

    static sortChapters(chapters) {
      let sorter = natsort({ asc: true, insensitive: true })
      chapters.sort((a, b) => sorter(a.group_id, b.group_id))
      chapters.sort((a, b) => sorter(a.chapter, b.chapter))
      let pv = ''
      chapters.forEach(c => {
        c.__prev_vol = pv
        if (c.volume) {
          pv = c.volume
        }
      })
      chapters.sort((a, b) => sorter(a.volume || a.__prev_vol, b.volume || b.__prev_vol))
      chapters.forEach(c => { delete c.__prev_vol })
    }

    static create(id, force) {
      if (!force && id in Manga.cache) {
        return Promise.resolve(Manga.cache[id])
      }

      // return fetch(new Request(this.API_URL + id, {
      //   headers: new Headers({
      //     'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
      //     'Cookie': 'mangadex_h_toggle=1'
      //   })
      // })).then(res => res.json()).then(data => {
      return jqFetch({
        url: this.API_URL + id,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
        },
        dataType: 'json'
      }).then(data => {
        Manga.cache[id] = new Manga(data)
        return Manga.cache[id]
      }).catch(err => {
        console.error(err)
        return Promise.reject(new Error("Could not load Manga data."))
      })
    }

    static get API_URL() { return '/api/3640f3fb/' }
  }

  Manga.cache = {}

  class Chapter {
    constructor(data) {
      this._data = data
    }

    get id() { return this._data.chapter_id }
    get title() { return this._data.chapter_title }
    get langCode() { return this._data.other_chapters[this.id].lang_flag }
    get langName() { return this._data.other_chapters[this.id].lang_name }
    get totalPages() { return this._data.page_array.length }
    // get groupIds() { return [this._data.group_id, this._data.group_id_2, this._data.group_id_3] }
    get groupIds() { return [this._data.other_groups[this.id].group_id, this._data.other_groups[this.id].group_id_2, this._data.other_groups[this.id].group_id_3] }
    // get groupNames() { return [this._data.group_name, this._data.group_name_2, this._data.group_name_3] }
    get groupNames() { return [this._data.other_groups[this.id].group_name, this._data.other_groups[this.id].group_name_2, this._data.other_groups[this.id].group_name_3] }
    get prevChapterId() { return this.manga.getPrevChapterId(this.id) }
    get nextChapterId() { return this.manga.getNextChapterId(this.id) }

    getPage(pg) {
      return pg >= 1 && pg <= this.totalPages ? this._data.page_array[pg - 1] : ''
    }

    imageURL(pg) {
      return this._data.server + this._data.dataurl + '/' + this.getPage(pg)
    }

    makeMangaChapterList() {
      this.manga.makeChapterList(this._data.other_groups[this.id].lang_flag, this.groupIds)
    }

    loadManga(force) {
      return Manga.create(this._data.manga_id, force).then(manga => {
        this.manga = manga

        // TODO: all this stuff should be in the manga api
        manga._data.id = this._data.manga_id
        manga._data.title = this._data.manga_title
        manga._data.url = this._data.manga_url
        manga._data.long_strip = this._data.long_strip
        manga._data.lang_code = this._data.flag_url
        manga._data.lang_name = this._data.lang

        this.makeMangaChapterList()
        return this
      })
    }

    static create(id, force) {
      if (!force && id in Chapter.cache) {
        return Promise.resolve(Chapter.cache[id])
      }
      // return fetch(new Request(this.API_URL + id, {
      //   headers: new Headers({
      //     'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
      //     'Cookie': 'mangadex_h_toggle=1'
      //   })
      // }))
      // .then(res => res.text()).then(data => {
      return jqFetch({
        url: this.API_URL + id,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
        }
      }).then(data => {
        const json = data.match(/<script data-type="chapter">(.*?)<\/script>/)
        if (json && json[1]) {
          return JSON.parse(json[1])
        } else {
          const alert = data.match(/<div class='alert alert-danger.*?>(.*?)<\/div>/)
          return Promise.reject(alert[1])
        }
      }).then(data => {
        const chapter = new Chapter(data)
        Chapter.cache[id] = chapter
        return chapter.loadManga()
      }).catch(err => {
        console.error(err)
        return Promise.reject(new Error("Could not load Chapter data."))
      })
    }

    static get API_URL() { return '/chapter/' }
  }

  Chapter.cache = {}

  class Follows {
    constructor(data) {
      this.chapters = data
    }

    get unreadChapters () {
      return this.chapters.filter(c => c.id && !c.read)
    }

    get unreadManga () {
      return this.unreadChapters.reduce((acc, cur) => {
        if (!acc[cur.mangaId]) {
          acc[cur.mangaId] = {
            id: cur.mangaId,
            title: cur.mangaTitle,
            chapters: []
          }
        }
        acc[cur.mangaId].chapters.push(cur)
        return acc
      }, {})
    }

    static create() {
      return jqFetch({
        url: '/follows'
      }).then(data => {
        const rows = data.match(/<tr id="chapter_[\s\S]*?<\/tr>/gim)
        let mangaId = 0
        let mangaTitle = ''
        return rows.map(row => {
          const none = [null,null]
          mangaId = parseInt((row.match(/\/manga\/(\d*?)\//) || none)[1]) || mangaId
          // mangaTitle = (row.match(/\/manga\/.*?'>(.*)<\/a>/) || none)[1] || mangaTitle
          mangaTitle = (row.match(/<a .*?title='(.*?)'.*?>/) || none)[1] || mangaTitle
          return {
            id: parseInt((row.match(/data-chapter-id="(\d*?)"/) || none)[1]) || null,
            mangaId,
            mangaTitle,
            title: (row.match(/data-chapter-name="(.*?)"/) || none)[1],
            chapter: parseFloat((row.match(/data-chapter-num="([\d\.]*?)"/) || none)[1]) || null,
            volume: parseFloat((row.match(/data-volume-num="([\d\.]*?)"/) || none)[1]) || null,
            read: /chapter_mark_unread_button/.test(row),
          }
        })
      }).then(data => {
        return new Follows(data)
      }).catch(err => {
        console.error(err)
        return Promise.reject(new Error("Could not load Follows data."))
      })
    }
  }

  const API = { Manga, Chapter, Follows }

  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = API
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      return API
    })
  } else if (typeof exports === 'object') {
    exports.API = API
  } else {
    (typeof window !== 'undefined' ? window : this).API = API
  }

})();