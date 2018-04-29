// ==UserScript==
// @name         MangaDex Mass Uploader
// @namespace    Teasday
// @version      1.3
// @license      GNU GPLv3
// @description  Upload en mass
// @author       Teasday
// @match        https://mangadex.org/upload/*
// @icon         https://mangadex.org/favicon.ico
// @homepageURL  https://teasday.github.io/userscripts/mangadex-massuploader/
// @updateURL    https://raw.githubusercontent.com/teasday/userscripts/master/mangadex-massuploader/mangadex-massuploader.meta.js
// @downloadURL  https://raw.githubusercontent.com/teasday/userscripts/master/mangadex-massuploader/mangadex-massuploader.user.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js
// @grant        none
// ==/UserScript==

// Based on https://ewasion.github.io/userscripts/mangadex-upload/

/* jshint asi: true */
(function() {
  'use strict'

  const $ = jQuery.noConflict(true)

  const regexDefaultVolume  = /.*v[^\dc]*?(\.?\d+(?:\.\d+)*[a-zA-Z]?\d*)/i
  const regexDefaultChapter = /.*c[^\dv]*?(\.?\d+(?:\.\d+)*[a-zA-Z]?\d*)/i
  const regexDefaultGroup = /.*(?:\[([^\]]+)\].*)/i
  const regexZeroPad = /^0+(?=\d)/

  const mangaId = $('#manga_id').val()
  const langPicker = $('#lang_id').clone().attr('id', null)
  const groupPicker = $('#group_id')
  const actions = $('#upload_form > div:last-child').prev()

  const panel = $(
  `<div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title">
        <span class="fas fa-upload fa-fw" aria-hidden="true" title=""></span> Mass upload Beta
        <small>v1.3 by Teasday</small>
      </h3>
    </div>
    <div class="panel-body">
    </div>
  </div>`)
  panel.insertBefore($('#content .panel:eq(1)'))
  const panelBody = panel.find('.panel-body')

  const settings = $('<div id="tea-mu-settings" class="form-horizontal">').appendTo(panelBody)

  /* CSS */

  $('<style>', { text: `
    #tea-mu-settings input,
    #tea-mu-settings textarea {
      margin-bottom: 1em;
    }
    #tea-mu-chapter-list td {
      vertical-align: middle;
    }
    #tea-mu-chapter-list td,
    #tea-mu-chapter-list tr {
      transition: background 0.2s ease;
    }
    #tea-mu-chapter-list tr {
      background-image: linear-gradient(90deg, #325560, #254751);
      background-repeat: repeat-y;
      background-size: 0%;
    }
    #tea-mu-chapter-list tbody:empty:after {
      content: 'No files selected.';
    }
    #tea-mu-console-area {
      background: rgba(0,0,0,0.35);
      padding: 0.5em 1em;
      margin: 1em 0;
    }
    #tea-mu-console-area p {
      margin: 0.5em 0;
    }
  `}).appendTo(document.head)

  /* HTML */

  $('<h4>Manga settings</h4>').appendTo(settings)

  // Manga
  $('<label class="col-sm-3 control-label">Manga name</label>').appendTo(settings)
  const inputMangaName = $('<input>', {
    type: 'text',
    class: 'form-control',
    disabled: 'disabled',
    value: $('#upload_form input:eq(0)').val(),
  }).appendTo($('<div class="col-sm-9">').appendTo(settings))
  const inputMangaId = $('<input>', {
    type: 'hidden',
    value: $('#upload_form input:eq(1)').val(),
  }).appendTo(settings)

  // Language
  $('<label class="col-sm-3 control-label">Language</label>').appendTo(settings)
  langPicker.removeClass('selectpicker').appendTo($('<div class="col-sm-9">').appendTo(settings))

  $('<h4>File settings</h4>').appendTo(settings)

  // Regex
  $('<label class="col-sm-3 control-label">Volume regex</label>').appendTo(settings)
  const inputRegexVolume = $('<input>', {
    type: 'text',
    class: 'form-control',
    placeholder: 'Volume regex',
    value: regexDefaultVolume,
  }).appendTo($('<samp class="col-sm-9">').appendTo(settings))

  $('<label class="col-sm-3 control-label">Chapter regex</label>').appendTo(settings)
  const inputRegexChapter = $('<input>', {
    type: 'text',
    class: 'form-control',
    placeholder: 'Chapter regex',
    value: regexDefaultChapter,
  }).appendTo($('<samp class="col-sm-9">').appendTo(settings))

  $('<label class="col-sm-3 control-label">Group regex</label>').appendTo(settings)
  const inputRegexGroup = $('<input>', {
    type: 'text',
    class: 'form-control',
    placeholder: 'Group regex',
    value: regexDefaultGroup,
  }).appendTo($('<samp class="col-sm-9">').appendTo(settings))

  $('<h4>Chapter settings</h4>').appendTo(settings)

  // Multi group
  $('<label class="col-sm-3 control-label">Amount of groups</label>').appendTo(settings)
  const inputGroupAmount = $('<input>', {
    type: 'number',
    class: 'form-control',
    value: 1,
    min: 1,
  }).prependTo($('<div class="col-sm-9"></div>').appendTo(settings))

  // Fallbacks
  $('<label class="col-sm-3 control-label">Group name fallbacks</label>').appendTo(settings)
  const inputGroupFallbacks = $('<textarea>', {
    class: 'form-control',
    style: 'resize:vertical',
    placeholder: `doki fansubs\ngroup 2\ngroup 3`
  }).appendTo($('<div class="col-sm-9">').appendTo(settings))

  // Chapter titles
  $('<label class="col-sm-3 control-label">Chapter titles</label>').appendTo(settings)
  const inputTitles = $('<textarea>', {
    class: 'form-control',
    style: 'resize:vertical',
    placeholder: `1:A Normal Person\n2:Peaceful\n3:Spectre`
  }).appendTo($('<div class="col-sm-9">').appendTo(settings))

  $('<h4>Chapter files</h4>').appendTo(settings)

  // Files
  $('<label class="col-sm-3 control-label">Files</label>').appendTo(settings)
  const inputFiles = $('<input>', {
    type: 'file',
    id: 'mass_files',
    style: 'color:#999;margin:0.5em 0;',
    multiple: '',
    accept: '.zip, .cbz',
  }).appendTo($('<div class="col-sm-9">').appendTo(settings))

  // Chapter table
  const chapterTable = $(`<table id="tea-mu-chapter-list" class="table table-condensed table-striped">
      <thead><tr>
        <td>Filename</td>
        <td style="width:6em">Volume number</td>
        <td style="width:6em">Chapter number</td>
        <td>Chapter title</td>
        <td style="width:7em">Group ID</td>
        <td>Group name</td>
        <td></td>
      </tr></thead>
    </table>`).appendTo(panelBody)
  const chapterTbody = $('<tbody>').appendTo(chapterTable)

  const inputUpload = $(`<button type="submit" class="btn btn-default" disabled>
      <span class="fas fa-upload fa-fw"></span> Upload
    </button>`).appendTo($('<div class="text-right">').appendTo(panelBody))

  const consoleArea = $(`<div id="tea-mu-console-area">`).appendTo(panelBody)

  const progressBarTotal = $(`<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="width: 0%;" class="progress-bar progress-bar-info"></div>`)
    .appendTo($(`<div class="progress" style="height: 38px; display: none;">`)
      .appendTo(panelBody))

  /* Logic */

  const strToRegex = (str) => {
    const flags = str.replace(/.*\/([gimy]*)$/, '$1')
    const pattern = str.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1')
    return new RegExp(pattern, flags)
  }
  const getRegexResult = (regex, str) => {
    const result = regex.exec(str)
    return result && result.length > 1 ? result[1] : ''
  }

  let titleMap, regexVolume, regexChapter, regexGroup

  class Chapter {
    constructor(file) {
      this.file = file
      this.volume = getRegexResult(regexVolume, file.name).replace(regexZeroPad, '')
      this.chapter = getRegexResult(regexChapter, file.name).replace(regexZeroPad, '')
      this.chapterName = titleMap.get(this.chapter) || ''

      this.groups = Array(parseInt(inputGroupAmount.val()) || 1).fill({})
      inputGroupFallbacks.val().split('\n').forEach((g, i) => this.setGroupName(i, g))
      this.setGroupName(0, getRegexResult(regexGroup, file.name))

      this.makeRow()
      this.uploading = false
      this.halted = false
      this.success = false
      this.progress = 0
    }

    setGroupId(index, id) {
      if (id) {
        const groupOpt = groupPicker.children().get().find(opt => opt.value === id)
        this.groups[index] = {
          id: groupOpt ? groupOpt.value : '',
          name: groupOpt ? groupOpt.text : ''
        }
      }
    }

    setGroupName(index, name) {
      if (name) {
        const groupOpt = groupPicker.children().get().find(opt => opt.text.toLowerCase() === name.toLowerCase())
        this.groups[index] = {
          id: groupOpt ? groupOpt.value : '',
          name: groupOpt ? groupOpt.text : ''
        }
      }
    }

    get fullname () {
      let str = `[${this.groupName || ' '}] `
      if (this.volume !== '')      str += `Vol. ${this.volume} `
      if (this.chapter !== '')     str += `Ch. ${this.chapter} `
      if (this.chapterName !== '') str += `${this.chapterName} `
      str += `(${this.file.name})`
      return str
    }
    get hasError () {
      return this.groups.some(g => g == null || !g.id || !g.name) || this.progress < 0
      // return !this.groupId || !this.groupName || this.progress < 0
    }
    get uploading () { return this._uploading }
    set uploading (val) {
      this._uploading = val
      this.update()
    }
    get progress () { return this._progress }
    set progress (val) {
      this._progress = val
      this.update()
    }
    get success () { return this._success }
    set success (val) {
      this._success = val
      this.update()
    }
    update () {
      this.tr
        .toggleClass('warning', this.hasError && this.progress === 0)
        .toggleClass('danger', this.hasError && this.progress === -1)
        .toggleClass('info', this.uploading && this.progress === 1)
        .css('background-size', `${this.progress*100}%`)
      this.tr.find('td:eq(6) .fa')
        .toggleClass('fa-trash',
          !this.uploading)
        .toggleClass('fa-exclamation-triangle',
          this.uploading && this.hasError)
        .toggleClass('fa-check',
          this.uploading && this.success)
        .toggleClass('fa-spinner fa-pulse',
          this.uploading && !this.success && !this.hasError && this.progress <= 1 && (!this.halted || this.halted && this.progress > 0))
        .toggleClass('fa-times',
          this.uploading && !this.success && !this.hasError && this.halted && this.progress === 0)
    }
    action () {
      if (!this.uploading) {
        Chapter.removeFromList(this)
      }
    }
    makeRow () {
      // this isn't the prettiest function ever but oh well
      const tr = this.tr = $(`<tr>`)
      $(`<td class="small">${this.file.name}</td>`)
        .appendTo(tr)
      const inputs = [
        ['volume',      'text'],
        ['chapter',     'text'],
        ['chapterName', 'text'],
      ]
      inputs.forEach(([val, type]) => {
        $('<input>', {
          type: type,
          class: 'form-control',
          name: val,
          value: this[val],
        }).change(e => {
          this[val] = e.target.value
          inputs.forEach(([val, type]) => tr.find(`input[name=${val}]`).val(this[val]))
          this.update()
        }).appendTo($('<td>').appendTo(tr))
      })
      const groupInputs = []
      for (let i = 0; i < this.groups.length; i++) {
        $('<input>', { type: 'number', class: 'form-control', name: `groupId${i+1}`, value: this.groups[i].id })
        .change(e => {
          this.setGroupId(i, e.target.value)
          tr.find(`input[name=groupName${i+1}]`).val(this.groups[i].name)
          this.update()
        }).appendTo($('<td>').appendTo(tr))
        $('<input>', { type: 'text', class: 'form-control', name: `groupName${i+1}`, value: this.groups[i].name })
        .on('input', e => {
          this.setGroupName(i, e.target.value)
          tr.find(`input[name=groupId${i+1}]`).val(this.groups[i].id)
          this.update()
        }).appendTo($('<td>').appendTo(tr))
      }
      $(`<td><i class="fa fa-fw fa-2x fa-trash"></i></td>`)
        .click(e => this.action()).appendTo(tr)
      this.update()
      return tr
    }
    get formData() {
      const fd = new FormData()
      fd.append('manga_id', mangaId)
      fd.append('volume_number', this.volume)
      fd.append('chapter_number', this.chapter)
      fd.append('chapter_name', this.chapterName)
      // fd.append('group_id', this.groupId)
      fd.append('lang_id', langPicker.val())
      fd.append('file', this.file)
      this.groups.forEach((g, i) => fd.append(`group_id${i>0 ? `_${i+1}` : ''}`, g.id))
      return fd
    }
    upload() {
      return new Promise((resolve, reject) => {
        if (this.hasError) {
          return resolve(this)
        }
        const onProgress = (e) => {
          if (e.lengthComputable) {
            this.progress = e.loaded/e.total
            uploader.onProgress()
          }
        }
        $.ajax({
          url: '/ajax/actions.ajax.php?function=chapter_upload',
          type: 'POST',
          data: this.formData,
          contentType: false,
          processData: false,
          xhr: () => {
            const myXhr = $.ajaxSettings.xhr()
            if (myXhr.upload)
              myXhr.upload.addEventListener('progress', onProgress, false)
            return myXhr
          },
          success: (errorMessage) => {
            if (errorMessage) {
              this.progress = -1
              try {
                uploadconsole.error($(errorMessage).text())
              } catch (err) {
                uploadconsole.error(errorMessage)
              }
              return reject()
            }
            this.success = true
            return resolve()
          },
          error: (err) => {
            this.progress = -1
            console.error(err)
            uploadconsole.error(err.toString())
            return reject()
          },
          always: () => {
            this.uploading = false
          }
        })
      })
    }

    static setList(files) {
      this.chapters = Array.from(files).map(file => new Chapter(file))
      chapterTbody.html('').append(this.chapters.map(c => c.tr))
    }
    static removeFromList (chapter) {
      chapter.tr.remove()
      this.chapters.splice(this.chapters.findIndex(c => c === chapter), 1)
    }
  }

  const uploadconsole = {
    write: (str, className = '') => {
      const time = (new Date()).toLocaleTimeString()
      consoleArea.append(`<p class="${className}">[${time}] ${str}</p>`)
    },
    log:     (str) => { uploadconsole.write(str) },
    error:   (str) => { uploadconsole.write(str, 'text-danger') },
    warning: (str) => { uploadconsole.write(str, 'text-warning') },
    success: (str) => { uploadconsole.write(str, 'text-success') },
    info:    (str) => { uploadconsole.write(str, 'text-info') },
    clear: () => {
      consoleArea.html('')
    }
  }

  const uploader = {
    started: false,
    halted: false,
    start: (i) => {
      uploader.started = true
      if (!uploader.halted && i < Chapter.chapters.length) {
        const ch = Chapter.chapters[i]
        ch.upload().finally(() => {
          uploader.start(i + 1)
        })
      } else {
        uploader.done()
      }
    },
    cancel: () => {
      uploadconsole.log(`Cancelling upload...`)
      uploader.halted = true
      Chapter.chapters.forEach(c => {
        c.halted = true
        c.update()
      })
    },
    onProgress: () => {
      const total  = Chapter.chapters.filter(c => !c.hasError).length
      const loaded = Chapter.chapters.reduce((a, c) => a + Math.max(c.progress, 0), 0)
      progressBarTotal.parent().show()
      progressBarTotal.width(`${loaded/total*100}%`)
    },
    done: () => {
      const delta    = new Date(Date.now() - uploader.timer)
      const skipped  = Chapter.chapters.filter(c => c.progress === 0)
      const failed   = Chapter.chapters.filter(c => c.progress === -1)
      const finished = Chapter.chapters.filter(c => c.progress === 1)

      if (skipped.length > 0)
        uploadconsole.warning(`Skipped ${skipped.length} chapters.`)
      if (failed.length > 0)
        uploadconsole.error(`Failed to upload ${failed.length} chapters.`)
      if (finished.length > 0)
        uploadconsole.info(`Finished uploading ${finished.length} chapters.`)
      uploadconsole.log(`Done in ${delta.getMinutes() ? delta.getMinutes()+' minute(s)' : ''} ${delta.getSeconds()} second(s).`)

      settings
        .find('input:not(:eq(0)),select,textarea')
        .attr('disabled', false)
      progressBarTotal.parent().hide()
      progressBarTotal.width(`0%`)
      inputUpload.html(`<span class="fas fa-upload fa-fw"></span> Upload Finished`)
        .attr('disabled', true)
      uploader.halted = false
      uploader.started = false
    },
  }


  inputFiles.change(e => {
    titleMap = new Map(inputTitles.val().split('\n').map(v => v.split(':')))
    regexVolume = strToRegex(inputRegexVolume.val())
    regexChapter = strToRegex(inputRegexChapter.val())
    regexGroup = strToRegex(inputRegexGroup.val())
    inputUpload.html(`<span class="fas fa-upload fa-fw"></span> Upload`)
    inputUpload.attr('disabled', e.target.files.length === 0)
    Chapter.setList(e.target.files)
    uploadconsole.clear()
    if (Chapter.chapters.find(c => c.hasError)) {
      uploadconsole.warning("Some of the chapters have faulty information and will be skipped unless fixed.")
    }
  })

  inputUpload.click(e => {
    if (!uploader.started) {
      panel
        .find('input,select,textarea')
        .attr('disabled', true)
      Chapter.chapters.forEach(c => c.uploading = true)
      uploader.timer = new Date()
      uploadconsole.log("Starting uploading.")
      uploader.start(0)
      inputUpload.html(`<span class="fas fa-spinner fa-pulse fa-fw"></span> Cancel Upload`)
    } else {
      uploader.cancel()
      inputUpload.html(`<span class="fas fa-times fa-fw"></span> Cancelled`)
    }
  })

})()