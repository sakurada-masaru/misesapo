/**
 * TemplateRenderer - テンプレートJSONに基づいて報告書を描画するコンポーネント
 * 
 * mode:
 * - 'view': 表示専用（詳細ページ用）
 * - 'edit': 入力可能（入力ページ用）
 * 
 * 対応するsection.type:
 * - group: フィールドグループ（meta_fields + fields）
 * - static: 静的テキスト
 * - static_plus_text: 静的テキスト＋入力欄
 * - field: 単一フィールド
 * - photos: 写真グループ
 * 
 * 対応するfield.type:
 * - text, number, date, textarea, radio, checkbox_group
 */

import React from 'react';
import styled from 'styled-components';

// ===== ユーティリティ =====

/**
 * ネストされたキー（例: "overview.work_minutes"）からオブジェクト内の値を取得
 */
export const getNestedValue = (obj, keyPath, defaultValue = null) => {
    if (!obj || !keyPath) return defaultValue;
    const keys = keyPath.split('.');
    let value = obj;
    for (const k of keys) {
        if (value === null || value === undefined) return defaultValue;
        value = value[k];
    }
    return value !== undefined ? value : defaultValue;
};

/**
 * ネストされたキーに値をセット（immutableに新しいオブジェクトを返す）
 */
export const setNestedValue = (obj, keyPath, newValue) => {
    if (!keyPath) return obj;
    const keys = keyPath.split('.');
    const result = { ...obj };
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        current[key] = current[key] ? { ...current[key] } : {};
        current = current[key];
    }
    current[keys[keys.length - 1]] = newValue;
    return result;
};

/**
 * テンプレートのペイロードをバリデーションする
 */
export const validateTemplatePayload = (template, payload) => {
    if (!template || !template.sections) return [];
    const errors = [];

    template.sections.forEach(section => {
        if (section.type === 'photos' && section.required) {
            const minItems = section.min_items || 1;
            const groups = section.presets || section.groups || [];
            let totalPhotos = 0;

            groups.forEach(group => {
                const photos = getNestedValue(payload, group.key) || [];
                totalPhotos += photos.length;
            });

            if (totalPhotos < minItems) {
                errors.push(`${section.label || '写真'}は最低${minItems}枚必要です`);
            }
        }

        // 他のフィールドタイプのバリデーションも必要に応じて追加
        if (section.type === 'group' && section.fields) {
            section.fields.forEach(field => {
                if (field.required) {
                    const val = getNestedValue(payload, field.key);
                    if (val === null || val === undefined || val === '') {
                        errors.push(`${field.label}を入力してください`);
                    }
                }
            });
        }

        if (section.type === 'field' && (section.required || section.field?.required)) {
            const field = section.field;
            const val = getNestedValue(payload, field.key);
            if (val === null || val === undefined || val === '') {
                errors.push(`${section.label || field.label}を入力してください`);
            }
        }
    });

    return errors;
};

/**
 * @param {object} template - テンプレートJSON
 * @param {object} report - DB直下のデータ（work_date, user_name等）
 * @param {object} payload - 入力データ
 * @param {function} onPayloadChange - payload変更時のコールバック (newPayload) => void
 * @param {string} mode - 'view' | 'edit'
 */
const TemplateRenderer = ({ template, payload, report, onChange, onPayloadChange, onFileUpload, onFileRemove, mode = 'view', footer }) => {
    // AdminReportNewPage 等で onPayloadChange を使っている場合への配慮
    const handleChange = onChange || onPayloadChange;

    if (!template) return <div>Template not found.</div>;
    const currentPayload = payload || {};
    if (!template || !template.sections) {
        return <EmptyMessage>テンプレートが見つかりません</EmptyMessage>;
    }

    const handlePayloadChange = (keyPath, value) => {
        if (mode !== 'edit' || !handleChange) return;
        const newPayload = setNestedValue(payload || {}, keyPath, value);
        handleChange(newPayload);
    };

    return (
        <ReportContainer $mode={mode}>
            <MobileCanvas $mode={mode}>
                {/* ヘッダー */}
                <ReportHeader $mode={mode}>
                    <ReportTitle $mode={mode}>{template.title || template.name}</ReportTitle>
                </ReportHeader>

                {/* ボディ（スクロールエリア） */}
                <ReportBody $mode={mode}>
                    {template.sections.map((section) => (
                        <SectionRenderer
                            key={section.id}
                            section={section}
                            report={report}
                            payload={payload || {}}
                            onChange={handlePayloadChange}
                            onFileUpload={onFileUpload}
                            onFileRemove={onFileRemove}
                            mode={mode}
                        />
                    ))}

                    {/* ボディ内末尾の情報（viewモード等） */}
                    {mode === 'view' && (
                        <ReportFooterInfo>
                            <span>提出：{report?.created_at ? new Date(report.created_at).toLocaleString('ja-JP') : '—'}</span>
                            <span>作業者：{report?.user_name || '—'}</span>
                        </ReportFooterInfo>
                    )}
                </ReportBody>

                {/* Sticky フッター（CTA用） */}
                {mode === 'edit' && footer && (
                    <ReportFooter $mode={mode}>
                        {footer}
                    </ReportFooter>
                )}
            </MobileCanvas>
        </ReportContainer>
    );
};

// ===== セクションレンダラ =====

const SectionRenderer = ({ section, report, payload, onChange, onFileUpload, onFileRemove, mode }) => {
    switch (section.type) {
        case 'group':
            return <GroupSection section={section} report={report} payload={payload} onChange={onChange} mode={mode} />;
        case 'static':
            return <StaticSection section={section} />;
        case 'static_plus_text':
            return <StaticPlusTextSection section={section} payload={payload} onChange={onChange} mode={mode} />;
        case 'field':
            return <FieldSection section={section} payload={payload} onChange={onChange} mode={mode} />;
        case 'photos':
            return <PhotosSection section={section} payload={payload} onChange={onChange} onFileUpload={onFileUpload} onFileRemove={onFileRemove} mode={mode} />;
        default:
            return <UnknownSection>{section.label}: (type={section.type})</UnknownSection>;
    }
};

// ===== グループセクション =====

const GroupSection = ({ section, report, payload, onChange, mode }) => {
    // meta_fields の文字列配列をオブジェクト配列に正規化
    const normalizedMetaFields = (section.meta_fields || []).map(mf => {
        if (typeof mf === 'string') {
            const labels = {
                work_date: '作業日',
                user_name: '担当作業員',
                created_at: '提出日時'
            };
            return { key: mf, label: labels[mf] || mf };
        }
        return mf;
    });

    return (
        <Section $mode={mode}>
            <SectionTitle $mode={mode} $required={section.required}>{section.label || section.name}</SectionTitle>
            <FieldList $mode={mode}>
                {/* meta_fields: report（=reportMeta）だけを見る。payloadは見ない。編集不可。 */}
                {normalizedMetaFields.map((mf) => (
                    <FieldRow key={mf.key} $mode={mode}>
                        <FieldLabel $mode={mode}>{mf.label}</FieldLabel>
                        <FieldValue $mode={mode}>{report?.[mf.key] ?? '—'}</FieldValue>
                    </FieldRow>
                ))}

                {/* fields: payloadから取得/編集 */}
                {section.fields?.map((field) => (
                    <FieldInput
                        key={field.key}
                        field={field}
                        payload={payload}
                        onChange={onChange}
                        mode={mode}
                    />
                ))}
            </FieldList>
        </Section>
    );
};

// ===== フィールド入力コンポーネント =====

const FieldInput = ({ field, payload, onChange, mode }) => {
    const value = getNestedValue(payload, field.key);
    const isEdit = mode === 'edit';
    const inputId = `field-${field.key.replace(/\./g, '-')}`;
    const isRequired = field.required;

    // checkbox_group の場合
    if (field.type === 'checkbox_group') {
        const values = Array.isArray(value) ? value : [];
        return (
            <FieldRow $block $mode={mode}>
                <FieldLabel as="label" $mode={mode} htmlFor={`${inputId}-0`} $required={isRequired}>{field.label}</FieldLabel>
                <ChoiceList $mode={mode}>
                    {field.options?.map((opt, i) => {
                        const optValue = opt.value !== undefined ? opt.value : opt;
                        const optLabel = opt.label !== undefined ? opt.label : opt;
                        const itemId = `${inputId}-${i}`;
                        const isChecked = opt.key
                            ? (getNestedValue(payload, opt.key) || false)
                            : values.includes(optValue);

                        const handleToggle = () => {
                            if (opt.key) {
                                onChange(opt.key, !isChecked);
                            } else {
                                const newValues = isChecked
                                    ? values.filter(v => v !== optValue)
                                    : [...values, optValue];
                                onChange(field.key, newValues);
                            }
                        };

                        return (
                            <ChoiceRow
                                key={opt.key || String(optValue)}
                                $mode={mode}
                                id={itemId}
                                name={opt.key || field.key}
                                className={isChecked ? 'is-active' : ''}
                                onClick={() => isEdit && handleToggle()}
                                disabled={!isEdit}
                            >
                                <span>{optLabel}</span>
                            </ChoiceRow>
                        );
                    })}
                </ChoiceList>
            </FieldRow>
        );
    }

    // radio の場合
    if (field.type === 'radio') {
        return (
            <FieldRow $block $mode={mode}>
                <FieldLabel as="label" $mode={mode} htmlFor={`${inputId}-0`} $required={isRequired}>{field.label}</FieldLabel>
                <ChoiceList $mode={mode}>
                    {field.options?.map((opt, i) => {
                        const optValue = opt.value !== undefined ? opt.value : opt;
                        const optLabel = opt.label !== undefined ? opt.label : opt;
                        const itemId = `${inputId}-${i}`;
                        const isSelected = value === optValue;
                        return (
                            <ChoiceRow
                                key={String(optValue)}
                                $mode={mode}
                                id={itemId}
                                name={field.key}
                                className={isSelected ? 'is-active' : ''}
                                onClick={() => isEdit && onChange(field.key, optValue)}
                                disabled={!isEdit}
                            >
                                <span>{optLabel}</span>
                            </ChoiceRow>
                        );
                    })}
                </ChoiceList>
            </FieldRow>
        );
    }

    // textarea の場合
    if (field.type === 'textarea') {
        return (
            <FieldRow $block>
                <FieldLabel as="label" $mode={mode} htmlFor={inputId} $required={isRequired}>{field.label}</FieldLabel>
                {isEdit ? (
                    <TextareaInput
                        id={inputId}
                        name={field.key}
                        value={value || ''}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                    />
                ) : (
                    <TextareaValue>{value || '—'}</TextareaValue>
                )}
            </FieldRow>
        );
    }

    // number の場合
    if (field.type === 'number') {
        return (
            <FieldRow>
                <FieldLabel as="label" $mode={mode} htmlFor={inputId} $required={isRequired}>{field.label}</FieldLabel>
                {isEdit ? (
                    <NumberInput
                        id={inputId}
                        name={field.key}
                        type="number"
                        value={value ?? ''}
                        onChange={(e) => onChange(field.key, e.target.value ? Number(e.target.value) : null)}
                        min={field.min}
                        max={field.max}
                        placeholder={field.placeholder || ''}
                    />
                ) : (
                    <FieldValue>{value ?? '—'}</FieldValue>
                )}
            </FieldRow>
        );
    }

    // date の場合
    if (field.type === 'date') {
        return (
            <FieldRow>
                <FieldLabel as="label" $mode={mode} htmlFor={inputId} $required={isRequired}>{field.label}</FieldLabel>
                {isEdit ? (
                    <DateInput
                        id={inputId}
                        name={field.key}
                        type="date"
                        value={value || ''}
                        onChange={(e) => onChange(field.key, e.target.value)}
                    />
                ) : (
                    <FieldValue>{value || '—'}</FieldValue>
                )}
            </FieldRow>
        );
    }

    // text（デフォルト）
    return (
        <FieldRow>
            <FieldLabel as="label" $mode={mode} htmlFor={inputId} $required={isRequired}>{field.label}</FieldLabel>
            {isEdit ? (
                <TextInput
                    id={inputId}
                    name={field.key}
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                />
            ) : (
                <FieldValue>{value ?? '—'}</FieldValue>
            )}
        </FieldRow>
    );
};

// ===== 静的セクション =====

const StaticSection = ({ section }) => {
    return (
        <Section>
            <SectionTitle>{section.label}</SectionTitle>
            <DescriptionText>{section.content}</DescriptionText>
        </Section>
    );
};

// ===== 単一フィールドセクション =====

const FieldSection = ({ section, payload, onChange, mode }) => {
    const field = section.field;
    if (!field) return null;
    return (
        <Section $mode={mode}>
            <SectionTitle $mode={mode} $required={section.required || field.required}>{section.label || field.label}</SectionTitle>
            <FieldInput
                field={field}
                payload={payload}
                onChange={onChange}
                mode={mode}
            />
        </Section>
    );
};

// ===== 静的＋テキストセクション =====

const StaticPlusTextSection = ({ section, payload, onChange, mode }) => {
    const textValue = getNestedValue(payload, section.text_key);
    const isEdit = mode === 'edit';
    const inputId = `static-text-${(section.text_key || 'note').replace(/\./g, '-')}`;

    return (
        <Section>
            <SectionTitle>{section.label}</SectionTitle>
            {Array.isArray(section.content) ? (
                <BulletList>
                    {section.content.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </BulletList>
            ) : (
                <DescriptionText>{section.content}</DescriptionText>
            )}
            {isEdit ? (
                <div style={{ marginTop: 12 }}>
                    <FieldLabel as="label" $mode={mode} htmlFor={inputId} style={{ marginBottom: 4 }}>補足入力</FieldLabel>
                    <TextareaInput
                        id={inputId}
                        name={section.text_key}
                        value={textValue || ''}
                        onChange={(e) => onChange(section.text_key, e.target.value)}
                        placeholder="補足があれば入力"
                    />
                </div>
            ) : (
                textValue && (
                    <NoteBlock style={{ marginTop: 12 }}>
                        <strong>補足:</strong> {textValue}
                    </NoteBlock>
                )
            )}
        </Section>
    );
};



// ===== 写真セクション =====

const PhotosSection = ({ section, payload, onFileUpload, onFileRemove, mode }) => {
    const isEdit = mode === 'edit';
    const photoGroups = section.presets || section.groups || [];

    const handleFileChange = (key, e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0 && onFileUpload) {
            files.forEach(file => onFileUpload(key, file));
        }
        e.target.value = '';
    };

    return (
        <Section>
            <SectionTitle $mode={mode} $required={section.required}>{section.label}</SectionTitle>
            {section.validation_summary && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>
                    {section.validation_summary}
                </div>
            )}
            <PhotoGroupsContainer>
                {photoGroups.map((group) => {
                    const photos = getNestedValue(payload, group.key) || [];
                    const inputId = `file-input-${group.key}`;

                    return (
                        <PhotoGroup key={group.key}>
                            <PhotoGroupTitle as="label" htmlFor={inputId}>
                                {group.label} {section.required && <span style={{ color: '#f87171', fontSize: '10px' }}>*</span>}
                            </PhotoGroupTitle>
                            <PhotoGrid>
                                {photos.map((img, i) => (
                                    <PhotoItemBox key={i}>
                                        <PhotoItem href={img.url || img} target="_blank">
                                            <img src={img.url || img} alt={group.label} />
                                        </PhotoItem>
                                        {isEdit && (
                                            <PhotoRemoveBtn onClick={() => onFileRemove && onFileRemove(group.key, i)}>
                                                <i className="fas fa-times"></i>
                                            </PhotoRemoveBtn>
                                        )}
                                    </PhotoItemBox>
                                ))}
                                {isEdit && (
                                    <>
                                        <UploadBox htmlFor={inputId}>
                                            <i className="fas fa-plus"></i>
                                            <span>追加</span>
                                        </UploadBox>
                                        <input
                                            id={inputId}
                                            name={`photos-${group.key}`}
                                            aria-label={`${group.label}の写真をアップロード`}
                                            type="file"
                                            multiple
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(group.key, e)}
                                        />
                                    </>
                                )}
                            </PhotoGrid>
                            {!isEdit && photos.length === 0 && (
                                <EmptyPhoto>写真なし</EmptyPhoto>
                            )}
                        </PhotoGroup>
                    );
                })}
            </PhotoGroupsContainer>
            {section.helper && <HelperText>{section.helper}</HelperText>}
        </Section>
    );
};


// ===== スタイル =====

const ReportContainer = styled.div`
    display: flex;
    justify-content: center;
    background: ${props => props.$mode === 'edit' ? 'transparent' : '#f8fafc'};
    width: 100%;
    min-height: ${props => props.$mode === 'edit' ? 'auto' : '100vh'};
`;

const MobileCanvas = styled.div`
    width: 100%;
    max-width: ${props => props.$mode === 'edit' ? '800px' : '850px'};
    background: ${props => props.$mode === 'edit' ? '#0f172a' : '#ffffff'};
    color: ${props => props.$mode === 'edit' ? '#f8fafc' : '#1e293b'};
    min-height: ${props => props.$mode === 'edit' ? 'auto' : '100vh'};
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    
    ${props => props.$mode === 'edit' && `
        box-shadow: 0 12px 60px rgba(0,0,0,0.5);
        border-radius: 24px;
        margin-bottom: 40px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.05);
        font-family: 'Noto Sans JP', sans-serif;
    `}
    ${props => props.$mode !== 'edit' && `
        border-radius: 0;
        box-shadow: 0 0 10px rgba(0,0,0,0.05);
        padding: 40px 60px;
        font-family: 'Hiragino Mincho ProN', 'MS Mincho', serif;
        @media print {
            box-shadow: none;
            padding: 0;
        }
    `}

    @media (max-width: 420px) {
        border-radius: 0;
        margin: 0;
        padding: ${props => props.$mode === 'edit' ? '0' : '20px'};
    }
`;

const ReportHeader = styled.header`
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 16px;
    background: ${props => props.$mode === 'edit' ? 'rgba(15, 23, 42, 0.85)' : '#ffffff'};
    backdrop-filter: ${props => props.$mode === 'edit' ? 'blur(10px)' : 'none'};
    border-bottom: 1px solid ${props => props.$mode === 'edit' ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'};
    ${props => props.$mode !== 'edit' && `
        margin-bottom: 24px;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
    `}
`;

const ReportTitle = styled.h1`
    font-weight: 700;
    text-align: center;
    margin: 0;
    ${props => props.$mode === 'edit' ? `
        font-size: 16px;
        color: #f8fafc;
    ` : `
        font-size: 28px;
        padding-bottom: 8px;
        border-bottom: 3px double #000;
        display: inline-block;
        color: #000;
        letter-spacing: 0.1em;
    `}
`;

const ReportBody = styled.div`
    padding: 16px;
    flex: 1;
    /* スクロールバー非表示（任意） */
    &::-webkit-scrollbar {
        width: 4px;
    }
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
    }
`;

const Section = styled.section`
    margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
    font-weight: 700;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    
    ${props => props.$mode === 'edit' ? `
        font-size: 14px;
        color: #f8fafc;
        opacity: 0.9;
        &::before {
            content: '';
            display: block;
            width: 3px;
            height: 14px;
            background: ${props.$required ? '#f87171' : '#3b82f6'};
            border-radius: 99px;
        }
        ${props.$required ? `
            &::after {
                content: '必須';
                font-size: 10px;
                padding: 1px 6px;
                background: #ef4444;
                color: white;
                border-radius: 4px;
                margin-left: 4px;
            }
        ` : ''}
    ` : `
        font-size: 20px;
        color: #000;
        border-bottom: 1px solid #000;
        padding-bottom: 4px;
        margin-top: 20px;
        width: 100%;
        font-family: sans-serif;
    `}
`;

const FieldList = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${props => props.$mode === 'edit' ? '20px' : '0'};
`;

const FieldRow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    ${props => props.$mode !== 'edit' && `
        padding: 12px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        &:last-child { border-bottom: none; }
    `}
`;

const FieldLabel = styled.span`
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    
    ${props => props.$mode === 'edit' ? `
        font-size: 13px;
        opacity: 0.7;
        margin-left: 4px;
        color: inherit;
        ${props.$required ? `
            &::after {
                content: '必須';
                font-size: 9px;
                padding: 1px 5px;
                background: #ef4444;
                color: white;
                border-radius: 4px;
                font-weight: 800;
            }
        ` : ''}
    ` : `
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    `}
`;

const FieldValue = styled.div`
    font-weight: 500;
    ${props => props.$mode === 'edit' ? `
        font-size: 15px;
        color: #f8fafc;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    ` : `
        font-size: 16px;
        color: #1e293b;
        word-break: break-all;
        padding-left: 2px;
        white-space: pre-wrap;
    `}
`;

const ChoiceList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    ${props => props.$mode !== 'edit' && `
        flex-direction: row;
        flex-wrap: wrap;
        gap: 16px;
        margin-top: 2px;
    `}
`;

const ChoiceRow = styled.button`
    display: flex;
    align-items: center;
    padding: 0;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    
    ${props => props.$mode === 'edit' ? `
        width: 100%;
        justify-content: space-between;
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: #f8fafc;
        font-size: 15px;
        cursor: pointer;
        
        &::after {
            content: '';
            display: block;
            width: 18px;
            height: 18px;
            border-radius: 99px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: all 0.2s;
            flex-shrink: 0;
        }

        &.is-active {
            border-color: rgba(59, 130, 246, 0.5);
            background: rgba(59, 130, 246, 0.12);
            &::after {
                border-color: #3b82f6;
                box-shadow: inset 0 0 0 5px #3b82f6;
            }
        }
        &:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.06);
        }
    ` : `
        border: none;
        background: transparent;
        color: #000;
        gap: 6px;
        font-size: 16px;
        cursor: default;
        &::before {
            content: '□';
            font-size: 1.2em;
        }
        &.is-active {
            font-weight: bold;
            &::before {
                content: '☑';
            }
        }
    `}
`;

const ChoiceDot = styled.div`
    display: ${props => props.$mode === 'edit' ? 'block' : 'none'};
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.2s;
    position: relative;
    
    &.is-active {
        border-color: #3b82f6;
        &::after {
            content: '';
            position: absolute;
            top: 4px;
            left: 4px;
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 99px;
        }
    }
`;

const ChoiceBox = styled.div`
    display: ${props => props.$mode === 'edit' ? 'flex' : 'none'};
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 10px;
    
    &.is-checked {
        border-color: #3b82f6;
        background: #3b82f6;
        color: white;
    }
`;

const TextInput = styled.input`
    width: 100%;
    padding: 14px 16px;
    border-radius: 14px;
    color: inherit;
    font-size: 15px;
    transition: border-color 0.2s;
    
    ${props => props.$mode === 'edit' ? `
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        &:focus { border-color: #3b82f6; outline: none; }
    ` : `
        border: 1px solid #e2e8f0;
        background: #fff;
    `}
    
    &::placeholder {
        opacity: 0.3;
    }
`;

const NumberInput = styled(TextInput)`
    width: 120px;
`;
const DateInput = styled(TextInput)``;

const TextareaInput = styled.textarea`
    width: 100%;
    min-height: 120px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: inherit;
    font-size: 15px;
    line-height: 1.6;
    resize: none;
    
    &:focus {
        outline: none;
        border-color: #3b82f6;
    }
`;

const TextareaValue = styled.div`
    padding: 14px 16px;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
`;

const NoteBlock = styled(TextareaValue)``;

const DescriptionText = styled.p`
    font-size: 14px;
    line-height: 1.7;
    opacity: 0.7;
    margin: 0;
`;

const BulletList = styled.ul`
    margin: 8px 0 0 20px;
    padding: 0;
    font-size: 14px;
    line-height: 1.7;
    opacity: 0.7;
`;

const HelperText = styled.p`
    font-size: 11px;
    color: #f87171;
    opacity: 0.8;
    margin: 12px 0 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    &::before {
        content: '\\f05a';
        font-family: "Font Awesome 5 Free";
        font-weight: 900;
    }
`;

const HintText = styled.p`
    font-size: 12px;
    opacity: 0.5;
    margin: -8px 0 16px 4px;
`;

const PhotoGroupsContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 500px;
    margin: 0 auto;
    width: 100%;
`;

const PhotoGroup = styled.div``;

const PhotoGroupTitle = styled.h4`
    font-size: 13px;
    font-weight: 600;
    opacity: 0.6;
    margin: 0 0 12px 0;
    text-align: center;
    width: 100%;
    display: block;
`;

const PhotoGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 150px));
    gap: 16px;
    justify-content: center;
    width: 100%;
`;

const PhotoItemBox = styled.div`
    position: relative;
    width: 100%;
    aspect-ratio: 1;
`;

const PhotoItem = styled.a`
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 14px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    &:hover {
        transform: scale(1.02);
        border-color: rgba(255, 255, 255, 0.2);
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;

const PhotoRemoveBtn = styled.button`
    position: absolute;
    top: -4px;
    right: -4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ef4444;
    color: white;
    border: 2px solid #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    cursor: pointer;
    z-index: 2;
`;

const UploadBox = styled.label`
    width: 100%;
    aspect-ratio: 1;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.02);
    
    &:hover {
        background: rgba(59, 130, 246, 0.05);
        border-color: rgba(59, 130, 246, 0.5);
        color: #3b82f6;
    }
    
    i { font-size: 24px; }
    span { font-size: 11px; font-weight: 600; }
`;

const EmptyPhoto = styled.div`
    padding: 24px;
    text-align: center;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    font-size: 13px;
    opacity: 0.5;
    margin: 0 auto;
    width: 100%;
`;

const ReportFooter = styled.footer`
    position: sticky;
    bottom: 0;
    padding: 16px;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const ReportFooterInfo = styled.div`
    margin-top: 40px;
    padding: 24px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    opacity: 0.4;
    text-align: center;
`;

const EmptyMessage = styled.div`
    padding: 60px 20px;
    text-align: center;
    opacity: 0.5;
`;

const UnknownSection = styled.div`
    padding: 16px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 12px;
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 20px;
`;

export default TemplateRenderer;
