// URLパラメータからフォームデータを取得して表示
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const name = urlParams.get('name') || '';
  const furigana = urlParams.get('furigana') || '';
  const phone = urlParams.get('phone') || '';
  const email = urlParams.get('email') || '';
  const jobType = urlParams.get('job_type') || '';

  // 表示
  document.getElementById('confirm-name').textContent = name || '-';
  document.getElementById('confirm-furigana').textContent = furigana || '-';
  document.getElementById('confirm-phone').textContent = phone || '-';
  document.getElementById('confirm-email').textContent = email || '-';

  // 隠しフィールドに設定
  document.getElementById('hidden-name').value = name;
  document.getElementById('hidden-furigana').value = furigana;
  document.getElementById('hidden-phone').value = phone;
  document.getElementById('hidden-email').value = email;
  document.getElementById('hidden-job-type').value = jobType;
})();

