// ========== МОЖНО МЕНЯТЬ ===========
// Время в миллисекундах необходимое сайту, чтобы подгрузить песни в плейлисте.
// Повысь до 200-300 (или выше, если медленный интернет), если скрипт
// не долистывает до самого низа плейлиста.
const SLEEP_BEFORE_NEXT_PAGE_SCROLL = 150
const SLEEP_BEFORE_NEXT_POST_REQUEST = 1500


// ============ НЕ МЕНЯТЬ ============
// Если заглянуть в код страницы, то можно найти div с каждой песней в плейлисте.
// У этого div'a есть атрибут "data-audio", который представляет собой массив с
// кучей элементов. Данные, необходимые для отправки запроса о добавлении песни
// в избранное, находятся под данными индексами.
const INDEX_OF_AUDIO_ID = 0
const INDEX_OF_AUDIO_OWNER_ID = 1
const INDEX_OF_HASH = 13


/**
 * В строке с необходимым нам hash'ем находятся несколько других значений.
 * Возможно, они нужны для других операций с пенями (удаление/восстановление песни),
 * но нам нужно только самое первое значение.
 */
function getHash(str) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "/") {
      //
    } else {
      str = str.slice(i)
      break
    }
  }

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "/") {
      str = str.slice(0, i)
    } else {
      //
    }
  }

  return str
}

/**
 * Самая обычная sleep функция
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min
}

/**
 * Возвращаем разный список элементов с песнями в зависимости от того, надо ли начать 
 * с какой-то определенной песни.
 */
function getAudioRows() {
  console.log("Нужно продолжить с конкретной песни? (1 - если нужно, 0 - если нет)");
  console.log("(все песни при работе скрипта добавляются начиная от низа плейлиста и к верху)");
  const needToContinue = parseInt(prompt("Нужно продолжить с конкретной песни? (1 - если нужно, 0 - если нет) "))

  let songToStartFrom

  if (needToContinue) {
    let inputSongName = prompt("Введите название песни, с которой нужно продолжить (она не добавится): ")

    if (inputSongName === undefined || inputSongName === null) {
      console.log("Перезагрузите страницу и попробуйте снова");
      throw new Error();
    }

    inputSongName = inputSongName.trim().toLowerCase()

    const tmpApLayer = document.querySelector("div.ap_layer")
    const songNamesInElements = tmpApLayer.querySelectorAll("a.audio_row__title_inner")

    let foundSong

    for (let songName of songNamesInElements) {
      const songNameText = songName.textContent.trim().toLowerCase()
      if (songNameText.includes(inputSongName)) {
        foundSong = songName
        break

      }
    }

    if (foundSong === undefined || foundSong === null) {
      console.log("Песня не найдена :(");
      console.log("Перезагрузите страницу и попробуйте снова");
      throw new Error();
    }

    songToStartFrom = foundSong.closest("div.audio_row")
    const apLayer = document.querySelector("div.ap_layer")
    let audioRows = [...apLayer.querySelectorAll("div.audio_row")]
    return audioRows.slice(0, audioRows.indexOf(songToStartFrom))
  } else {
    // Находим нужные нам div'ы.
    const apLayer = document.querySelector("div.ap_layer")
    return apLayer.querySelectorAll("div.audio_row")
  }
}

async function main() {
  // Пролистываем страницу до самого низа, чтобы подгрузить названия всех песен.
  // По какой-то причине, перемотка страницы не работает внутри функции, поэтому
  // весь код я запускаю здесь как есть. Это неудобно читать, но зато оно работает.
  // Возможно, это как-то связано с асинхронностью.

  let prevAudioRow = undefined

  while (true) {
    const apLayer = document.querySelector("div.ap_layer")
    const audioRows = apLayer.querySelectorAll("div.audio_row")
    const currAudioRow = audioRows[audioRows.length - 1]

    if (currAudioRow === prevAudioRow) {
      console.log("ДОШЕЛ ДО КОНЦА ПЛЕЙЛИСТА");
      break
    } else {
      currAudioRow.scrollIntoView()
      prevAudioRow = currAudioRow
      await sleep(SLEEP_BEFORE_NEXT_PAGE_SCROLL)
    }
  }

  const audioRows = getAudioRows()

  /**
   * Создаём массив, в котором будут хранится объекты с данными, необходимыми
   * для отправки запроса о добавлении песни в избранное.
   */
  const songs = []

  /**
   * Распиливаем атрибут "data-audio" на нужные нам данные и молимся,
   * чтобы VK однажды не поменял индексы элементов.
   */
  audioRows.forEach((audio) => {
    const dataAudioRaw = audio.getAttribute("data-audio")
    const dataAudioJSON = JSON.parse(dataAudioRaw)
    songs.push({
      "audio_id": Number(dataAudioJSON[INDEX_OF_AUDIO_ID]),
      "audio_owner_id": Number(dataAudioJSON[INDEX_OF_AUDIO_OWNER_ID]),
      "hash": getHash(dataAudioJSON[INDEX_OF_HASH])
    })
  })

  // Проходимся по массиву в обратном порядке, чтобы музыка осталась в той же последовательности
  songs.reverse()

  console.log("ДОБАВЛЕНИЕ ПЕСЕН НАЧАТО, не закрывайте браузер");

  for (let i = 0; i < songs.length; i++) {
    // Отправляем POST запрос на сервера VK
    window.ajax.post(
      "/al_audio.php?act=add",
      songs[i],
      {}
    )
    /**
     * Отдыхаем SLEEP_BEFORE_NEXT_POST_REQUEST миллисекунд после каждого запроса,
     * чтобы пришедший с запоздание или опережением запрос не изменил порядок добавления
     * песен. Возможно, это же можно сделать более производительно, избавившись
     * от засыпания. Pull request will be much appreciated, так сказать.
     *
     * Добавляем в время случайности, чтобы обойти капчу.
     */
    await sleep(SLEEP_BEFORE_NEXT_POST_REQUEST + getRandomNumber(2050, 3498))
  }
  setTimeout(() => {console.log("ДОБАВЛЕНИЕ ПЕСЕН ЗАВЕРШЕНО");}, 3000)
}

await main()

/**
 * У кода есть проблемы с появлением каптчи. Пока что это решается задержкой между добавлением песен.
 * С данной задержкой каптча не появляется, что было проверенно на плейлисте из 105 песен.
 * Есть вероятность, что, если песен будет больше, то задержка не спасёт.
 *
 * TODO: Добавить приостановку добавления песен при получении каптчи от сервера.
 * TODO: Велечину задержки можно уменьшит, оптимизирорав этим время работы скрипта.
 * TODO: Добавить проверку наличия добавляемой песни в списке аудиозаписей.
 */
