// ==UserScript==
// @name         MangaDex Mass Follow Edit
// @namespace    Teasday
// @version      0.2
// @description  Edits follows massively
// @author       Teasday
// @match        http://beta.mangadex.org/follows/manga/*
// @icon         https://mangadex.org/favicon.ico
// @homepageURL  https://teasday.github.io/userscripts/mangadex-massfollowedit/
// @updateURL    https://raw.githubusercontent.com/teasday/userscripts/master/mangadex-massfollowedit/mangadex-massfollowedit.meta.js
// @downloadURL  https://raw.githubusercontent.com/teasday/userscripts/master/mangadex-massfollowedit/mangadex-massfollowedit.user.js
// @grant        none
// ==/UserScript==

(function() {
  'use strict'

  const create = (tagName = 'div', opts = {}) => {
    const el = document.createElement(tagName)
    if (opts.classes) { el.classList.add(...opts.classes) }
    for (let [key, val] of Object.entries(opts).filter(o => o[0] !== 'classes')) {
      el[key] = val
    }
    return el
  }

  const chapterTable = document.querySelector('#chapters')
  const editRow = chapterTable.insertBefore(create('div'), chapterTable.firstChild)
  const enterButton = editRow.appendChild(create('button', { textContent: 'Enter mass edit mode (use Simple/Expanded list)', classes: ['btn', 'btn-secondary', 'mr-1'] }))
  enterButton.addEventListener('click', evt => {
    enterButton.disabled = true
    const rows = Array.from(document.querySelectorAll('#chapters > div'))
    const checkboxes = rows
      .filter(row => row.querySelector('.manga_title'))
      .map(row => {
        const id = row.querySelector('.manga_unfollow_button').id
        return row.insertBefore(create('input', {
          value: id,
          type: 'checkbox',
          classes: ['form-check-input']
        }), row.firstChild)
      })
    const invertButton = editRow.appendChild(create('button', { textContent: 'Invert all selections', classes: ['btn', 'btn-secondary', 'mr-1']  }))
    invertButton.addEventListener('click', evt => checkboxes.forEach(c => c.checked = !c.checked))
    editRow.appendChild(create('span', { textContent: 'Set all selected to: ' }))
    const followSelect = editRow.appendChild(create('select', { classes: ['form-control', 'd-inline-block', 'w-auto', 'mr-1'] }))
    followSelect.appendChild(create('option', { textContent: 'Unfollow', value: 0 }))
    followSelect.appendChild(create('option', { textContent: 'Reading', value: 1, selected: true }))
    followSelect.appendChild(create('option', { textContent: 'Completed', value: 2 }))
    followSelect.appendChild(create('option', { textContent: 'On hold', value: 3 }))
    followSelect.appendChild(create('option', { textContent: 'Plan to read', value: 4 }))
    followSelect.appendChild(create('option', { textContent: 'Dropped', value: 5 }))
    followSelect.appendChild(create('option', { textContent: 'Re-reading', value: 6 }))
    const submitButton = editRow.appendChild(create('button', { textContent: 'Submit', classes: ['btn', 'btn-success']  }))
    submitButton.addEventListener('click', evt => {
      const selected = checkboxes.filter(c => c.checked).map(c => c.value)
      if (selected.length === 0)
        return
      submitButton.disabled = true
      let done = 0
      const total = selected.length
      const type = followSelect.value
      const setFollow = (id) => {
        submitButton.textContent = `${done++} / ${total} done`
        fetch(`/ajax/actions.ajax.php?function=${type == '0' ? 'manga_unfollow' : 'manga_follow'}&id=${id}&type=${type}`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
          .then(res => res.text())
          .then(data => {
            if (selected.length > 0) {
              setFollow(selected.shift())
            } else {
              submitButton.textContent = 'Reloading, please wait'
              location.reload()
            }
          })
      }
      if (type != '0' || confirm(`Setting ${total} item${total > 1 ? 's' : ''} to ${followSelect.options[type].text}. Are you sure?`)) {
        setFollow(selected.shift())
      } else {
        submitButton.disabled = false
      }
    })
  }, false)

})()