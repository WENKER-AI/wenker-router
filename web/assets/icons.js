/* WENKER — icon pixel (SVG render từ bitmap). Không emoji, không CDN.
 * Mỗi icon là mảng chuỗi: 'X' = bật, '.' = tắt. Render gộp các ô liền
 * theo hàng thành <rect> cho gọn, crispEdges giữ chất pixel.
 */
(function () {
  "use strict";

  var ICONS = {
    // thương hiệu: chữ W pixel
    w: [
      "X....XX....X",
      "X...X..X...X",
      "X...X..X...X",
      "X..X....X..X",
      "X..X....X..X",
      "X.X......X.X",
      "XX........XX",
      "X..........X",
      "X..........X",
      "X..........X",
      "............",
      "............"
    ],
    // cá voi + tia nước (dùng nội dung)
    whale: [
      "............",
      ".....X.X....",
      "......X.....",
      "....XXXX....",
      "...XXXXXX...",
      "..XXXXXXXX..",
      ".XXXXXXXXXX.",
      ".XXXXXXXXXX.",
      "..XXXXXXXX..",
      "...XXXXXX...",
      "............",
      "............"
    ],
    // định tuyến: ngã rẽ hình Y
    route: [
      "............",
      "..X.......X.",
      "..X.......X.",
      "...X.....X..",
      "...X.....X..",
      "....X...X...",
      "....XXXXX...",
      "......X.....",
      "......X.....",
      "......X.....",
      "............",
      "............"
    ],
    // alias: vòng lặp đổi tên
    refresh: [
      "....XXXX....",
      "..XX....XX..",
      ".X........X.",
      "XX.........X",
      "X..........X",
      "X..........X",
      ".X........X.",
      "..XX....XX..",
      "....XXXX..X.",
      "..........XX",
      ".........XX.",
      "............"
    ],
    // tương thích: phích cắm
    plug: [
      "....XX.XX...",
      "....XX.XX...",
      "....XX.XX...",
      "..XXXXXXXX..",
      "..XXXXXXXX..",
      "...XXXXXX...",
      "....XXXX....",
      ".....XX.....",
      ".....XX.....",
      "............",
      "............",
      "............"
    ],
    // dashboard: đồng hồ
    gauge: [
      "....XXXX....",
      "..XX....XX..",
      ".X..X..X..X.",
      "X....XX....X",
      "X....XX....X",
      "X.........X.",
      ".X........X.",
      "..XX....XX..",
      "....XXXX....",
      "............",
      "............",
      "............"
    ],
    // cơ sở dữ liệu: hộp/chai
    box: [
      "....XXXX....",
      "..XX....XX..",
      ".XX.XXXX.XX.",
      "XX.X....X.XX",
      "X..X....X..X",
      "X..X....X..X",
      "X..X....X..X",
      ".X.XXXXXX.X.",
      "..XX....XX..",
      "....XXXX....",
      "............",
      "............"
    ],
    // khoá: key/secret
    lock: [
      "....XXXX....",
      "...X....X...",
      "...X....X...",
      "....XXXX....",
      "..XXXXXXXX..",
      "..X......X..",
      "..X..XX..X..",
      "..X..XX..X..",
      "..X......X..",
      "..XXXXXXXX..",
      "............",
      "............"
    ],
    // theme: bảng màu
    palette: [
      "....XXXX....",
      "..XX....XX..",
      ".X..X..X..X.",
      "X...........",
      "X..X....X..X",
      "X...........",
      ".X..X..X..X.",
      "..XX....XX..",
      "....XXXX....",
      "............",
      "............",
      "............"
    ],
    // biểu đồ: log thật
    bars: [
      "............",
      "............",
      "............",
      "....XX......",
      ".X..XX..XX..",
      ".X..XX..XX..",
      ".X..XX..XX..",
      ".X..XX..XX..",
      ".X..XX..XX..",
      ".X..XX..XX..",
      "XXXXXXXXXXXX",
      "............"
    ],
    // code </>
    code: [
      "............",
      "....X...X...",
      "...X.....X..",
      "..X.......X.",
      ".X.........X",
      "..X.......X.",
      "...X.....X..",
      "....X...X...",
      "............",
      "............",
      "............",
      "............"
    ],
    // bug
    bug: [
      "....XXXX....",
      "...X....X...",
      "..X.X..X.X..",
      ".XX.XXXX.XX.",
      "X...X..X...X",
      ".X..X..X..X.",
      "..X.X..X.X..",
      "....XXXX....",
      ".....XX.....",
      "............",
      "............",
      "............"
    ],
    // monitor
    monitor: [
      "XXXXXXXXXXXX",
      "X..........X",
      "X.XXXXXXXX.X",
      "X.XXXXXXXX.X",
      "X.XXXXXXXX.X",
      "X.XXXXXXXX.X",
      "X..........X",
      "XXXXXXXXXXXX",
      ".....XX.....",
      ".....XX.....",
      "....XXXX....",
      "............"
    ],
    // list
    list: [
      "............",
      "XX....XXXXXX",
      "XX....XXXXXX",
      "XX..........",
      "XX....XXXXXX",
      "XX....XXXXXX",
      "XX..........",
      "XX....XXXXXX",
      "XX....XXXXXX",
      "............",
      "............",
      "............"
    ],
    // heart / health
    heart: [
      "............",
      "..XX....XX..",
      ".XXXX..XXXX.",
      ".XXXXXXXXXX.",
      ".XXXXXXXXXX.",
      ".XXXXXXXXXX.",
      "..XXXXXXXX..",
      "...XXXXXX...",
      "....XXXX....",
      ".....XX.....",
      "............",
      "............"
    ],
    // globe
    globe: [
      "....XXXX....",
      "..XX.XX.XX..",
      ".XX..XX..XX.",
      "X....XX....X",
      "XX...XX...XX",
      "X....XX....X",
      ".XX..XX..XX.",
      "..XX.XX.XX..",
      "....XXXX....",
      "............",
      "............",
      "............"
    ],
    // gamepad
    gamepad: [
      "............",
      ".XX......XX.",
      "XXXXXXXXXXXX",
      "X..XX..XX..X",
      "X.XXXX.XXX.X",
      "X.XX..X.XX.X",
      "XXXXXXXXXXXX",
      ".XX......XX.",
      "............",
      "............",
      "............",
      "............"
    ],
    // mini game: cá
    fish: [
      "............",
      "......XX....",
      "....XXXX..XX",
      "..XXXXXXXXXXX",
      "..XXXXXXXXXXX",
      "....XXXX..XX",
      "......XX....",
      "............",
      "............",
      "............",
      "............",
      "............"
    ],
    // mini game: rắn
    snake: [
      "............",
      "............",
      ".XXXX.......",
      "....X.......",
      "....XXX.....",
      "......X.....",
      "....XXX.....",
      "....X.......",
      ".XXXX.......",
      "............",
      "............",
      "............"
    ],
    // mini game: chim
    bird: [
      "............",
      ".....XX.....",
      "....XXXX....",
      "...XXXXX....",
      "..XXXXXXXXXX",
      ".XXXXXXXXXXX",
      "..XXX..XXXX.",
      "..XX....XX..",
      "............",
      "............",
      "............",
      "............"
    ]
  };

  function toSvg(rows) {
    var h = rows.length;
    var w = rows[0].length;
    var parts = [];
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      var x = 0;
      while (x < w) {
        if (row[x] === "X") {
          var start = x;
          while (x < w && row[x] === "X") x++;
          parts.push('<rect x="' + start + '" y="' + y + '" width="' + (x - start) + '" height="1"/>');
        } else {
          x++;
        }
      }
    }
    return (
      '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      parts.join("") +
      "</svg>"
    );
  }

  var cache = {};
  function icon(name) {
    if (cache[name]) return cache[name];
    var rows = ICONS[name];
    cache[name] = rows ? toSvg(rows) : "";
    return cache[name];
  }

  // Bọc svg trong <span class="px"> để CSS kiểm soát màu/cỡ qua currentColor.
  function renderPixIcons(root) {
    var nodes = (root || document).querySelectorAll("[data-icon]");
    Array.prototype.forEach.call(nodes, function (el) {
      var name = el.getAttribute("data-icon");
      var svg = icon(name);
      if (svg) el.innerHTML = '<span class="px">' + svg + "</span>";
    });
  }

  window.WenkerIcons = { icon: icon, render: renderPixIcons, names: Object.keys(ICONS) };
})();
